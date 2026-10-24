package pl.wsb.kasyno.slots;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionTemplate;
import pl.wsb.kasyno.slots.application.engine.ConfiguredSlotEngine;
import pl.wsb.kasyno.slots.application.engine.GameMathProvider;
import pl.wsb.kasyno.slots.application.engine.RandomSource;
import pl.wsb.kasyno.slots.application.engine.RoundJson;
import pl.wsb.kasyno.slots.application.engine.SlotEngineRegistry;
import pl.wsb.kasyno.slots.entity.SlotMachineRepository;
import pl.wsb.kasyno.slots.entity.SpinRoundRepository;
import pl.wsb.kasyno.slots.entity.SpinStatus;
import pl.wsb.kasyno.slots.web.SlotController;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Prawdziwe silniki trzech gier w pełnej aplikacji (HTTP → SpinService → silnik → portfel → baza):
 * odpowiedź w formacie kontraktu § 2.4, spójność salda, zapis rundy, odtworzenie rundy z ziarna i idempotencja.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("Silniki gier przez API: format odpowiedzi, saldo, zapis i odtworzenie rundy")
class SlotEnginesIntegrationTest {

    private static final int SPINS = 25;
    private static final ObjectMapper JSON = new ObjectMapper();

    @Autowired
    private MockMvc mvc;
    @Autowired
    private SlotEngineRegistry engines;
    @Autowired
    private GameMathProvider mathProvider;
    @Autowired
    private SlotMachineRepository machines;
    @Autowired
    private SpinRoundRepository rounds;
    @Autowired
    private TransactionTemplate transactions;

    private MockHttpSession login(String nick) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"nick\":\"" + nick + "\"}")).andExpect(status().isOk()).andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private MvcResult spin(MockHttpSession session, String game, long bet, String key) throws Exception {
        return mvc.perform(post("/api/slots/" + game + "/spins").session(session)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"bet\":" + bet + "}"))
                .andExpect(status().isOk())
                .andReturn();
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource({"cebulowy-777, 10, Gracz_S1", "zloty-faraon, 20, Gracz_S2", "krysztalowa-kaskada, 20, Gracz_S3"})
    @DisplayName("seria spinów: kształt § 2.4, saldo przed/po, suma kroków = totalWin, zapis i odtworzenie z seeda")
    void spinsFollowContract(String game, long bet, String nick) throws Exception {
        MockHttpSession session = login(nick);
        long expectedBalance = 10_000;
        Set<String> seeds = new HashSet<>();
        ConfiguredSlotEngine engine = (ConfiguredSlotEngine) engines.find(game).orElseThrow();
        var math = transactions.execute(tx -> mathProvider.mathFor(machines.findByCodeAndActiveTrue(game).orElseThrow()));

        for (int i = 0; i < SPINS; i++) {
            MvcResult result = spin(session, game, bet, nick + "-" + i);
            String body = result.getResponse().getContentAsString();
            JsonNode response = JSON.readTree(body);

            assertThat(response.fieldNames()).toIterable().containsExactly("roundId", "gameCode", "bet", "totalWin",
                    "multiplier", "tier", "balanceBefore", "balanceAfter", "seed", "steps");
            assertThat(response.get("gameCode").asText()).isEqualTo(game);
            assertThat(response.get("bet").isIntegralNumber()).isTrue();
            assertThat(response.get("bet").asLong()).isEqualTo(bet);
            long totalWin = response.get("totalWin").asLong();
            assertThat(response.get("balanceBefore").asLong()).isEqualTo(expectedBalance);
            assertThat(response.get("balanceAfter").asLong()).isEqualTo(expectedBalance - bet + totalWin);
            expectedBalance = response.get("balanceAfter").asLong();
            assertThat(response.get("seed").asText()).matches("[0-9a-f]{16}");
            seeds.add(response.get("seed").asText());

            JsonNode steps = response.get("steps");
            assertThat(steps.get(0).get("type").asText()).isEqualTo("spin");
            long stepWins = 0;
            long lastTotal = 0;
            for (JsonNode step : steps) {
                if (step.has("win") && step.has("totalWin")) {
                    stepWins += step.get("win").asLong();
                    lastTotal = step.get("totalWin").asLong();
                    assertThat(lastTotal).isEqualTo(stepWins);
                }
            }
            assertThat(stepWins).isEqualTo(totalWin);
            assertThat(lastTotal).isEqualTo(totalWin);

            // runda zapisana: resultJson = odpowiedź, status SETTLED, seed w bazie = seed z odpowiedzi
            long roundId = response.get("roundId").asLong();
            long seed = Long.parseUnsignedLong(response.get("seed").asText(), 16);
            transactions.executeWithoutResult(tx -> {
                var round = rounds.findById(roundId).orElseThrow();
                assertThat(round.getStatus()).isEqualTo(SpinStatus.SETTLED);
                assertThat(round.getResultJson()).isEqualTo(body);
                assertThat(round.getSeed()).isEqualTo(seed);
            });

            // odtworzenie: ten sam seed → te same kroki animacji
            String replayed = RoundJson.stepsDocument(engine.playRound(math, bet, RandomSource.fromSeed(seed)).steps());
            assertThat(JSON.readTree(replayed).get("steps")).isEqualTo(steps);
        }
        assertThat(seeds).hasSize(SPINS);

        mvc.perform(get("/api/me").session(session)).andExpect(jsonPath("$.balance").value(expectedBalance));
        mvc.perform(get("/api/me/stats").session(session))
                .andExpect(jsonPath("$[0].gameCode").value(game))
                .andExpect(jsonPath("$[0].spins").value(SPINS))
                .andExpect(jsonPath("$[0].totalWagered").value(SPINS * bet));
        mvc.perform(get("/api/me/history").session(session))
                .andExpect(jsonPath("$.totalItems").value(SPINS))
                .andExpect(jsonPath("$.items[0].status").value("SETTLED"));
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource({"cebulowy-777, 100", "zloty-faraon, 200", "krysztalowa-kaskada, 200"})
    @DisplayName("ten sam Idempotency-Key: identyczna odpowiedź, nagłówek powtórki, zakład pobrany raz")
    void idempotentReplayWithRealEngine(String game, long bet) throws Exception {
        MockHttpSession session = login("Dubel_" + game.substring(0, 5));
        MvcResult first = spin(session, game, bet, "ten-sam-" + game);
        long balanceAfter = JSON.readTree(first.getResponse().getContentAsString()).get("balanceAfter").asLong();

        mvc.perform(post("/api/slots/" + game + "/spins").session(session).header("Idempotency-Key", "ten-sam-" + game)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"bet\":" + bet + "}"))
                .andExpect(status().isOk())
                .andExpect(header().string(SlotController.REPLAYED_HEADER, "true"))
                .andExpect(content().string(first.getResponse().getContentAsString()));
        mvc.perform(get("/api/me").session(session)).andExpect(jsonPath("$.balance").value(balanceAfter));
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource({"cebulowy-777, 8, 5", "zloty-faraon, 12, 20", "krysztalowa-kaskada, 9, -1"})
    @DisplayName("GET /api/slots/{code}: symbole z wypłatami, linie (gry liniowe) i opis funkcji")
    void detailsHaveSymbolsPaylinesAndFeatures(String game, int symbolCount, int paylineCount) throws Exception {
        var request = mvc.perform(get("/api/slots/" + game))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.symbols.length()").value(symbolCount))
                .andExpect(jsonPath("$.symbols[0].kind").value("NORMAL"))
                .andExpect(jsonPath("$.symbols[0].pays").isMap())
                .andExpect(jsonPath("$.features").isNotEmpty());
        if (paylineCount > 0) {
            request.andExpect(jsonPath("$.paylines.length()").value(paylineCount));
        } else {
            request.andExpect(jsonPath("$.paylines").doesNotExist());
        }
    }
}
