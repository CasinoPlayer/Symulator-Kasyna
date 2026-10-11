package pl.wsb.kasyno.slots;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import pl.wsb.kasyno.slots.web.SlotController;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Profil {@code demo} ({@code kasyno.demo.allow-seed=true}, jak w {@code application-demo.properties}): ziarno rundy
 * z nagłówka {@code X-Demo-Seed}, więc ta sama runda daje się odegrać ponownie (nagrywanie filmików do lobby).
 */
@SpringBootTest(properties = "kasyno.demo.allow-seed=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("X-Demo-Seed w profilu demo: ziarno rundy = podane")
class DemoSeedAllowedTest {

    private static final String SEED = "5f3a9c0e7b21d4a8";
    private static final ObjectMapper JSON = new ObjectMapper();

    @Autowired
    private MockMvc mvc;

    private MockHttpSession login(String nick) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"nick\":\"" + nick + "\"}")).andExpect(status().isOk()).andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private ResultActions spin(MockHttpSession session, String game, long bet, String seed) throws Exception {
        var request = post("/api/slots/" + game + "/spins").session(session)
                .contentType(MediaType.APPLICATION_JSON).content("{\"bet\":" + bet + "}");
        if (seed != null) {
            request.header(SlotController.DEMO_SEED_HEADER, seed);
        }
        return mvc.perform(request);
    }

    private static JsonNode body(ResultActions actions) throws Exception {
        return JSON.readTree(actions.andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    @Test
    @DisplayName("ten sam X-Demo-Seed u dwóch graczy: to samo ziarno w odpowiedzi i identyczne kroki rundy")
    void sameSeedSameRound() throws Exception {
        JsonNode first = body(spin(login("Demo_Pierwszy"), "zloty-faraon", 20, SEED));
        JsonNode second = body(spin(login("Demo_Drugi"), "zloty-faraon", 20, "0x" + SEED.toUpperCase()));

        assertThat(first.get("seed").asText()).isEqualTo(SEED);
        assertThat(second.get("seed").asText()).isEqualTo(SEED);
        assertThat(second.get("steps")).isEqualTo(first.get("steps"));
        assertThat(second.get("totalWin")).isEqualTo(first.get("totalWin"));
    }

    @Test
    @DisplayName("bez nagłówka ziarno nadal losowe (nagłówek jest opcjonalny także w demo)")
    void withoutHeaderRandom() throws Exception {
        MockHttpSession session = login("Demo_Losowy");

        String a = body(spin(session, "cebulowy-777", 10, null)).get("seed").asText();
        String b = body(spin(session, "cebulowy-777", 10, null)).get("seed").asText();

        assertThat(a).isNotEqualTo(b);
    }

    @Test
    @DisplayName("niepoprawny X-Demo-Seed → 400 VALIDATION_FAILED, zakład nie jest pobrany")
    void invalidSeed() throws Exception {
        MockHttpSession session = login("Demo_Zly");

        spin(session, "cebulowy-777", 10, "zzz")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        spin(session, "cebulowy-777", 10, "12345678901234567")
                .andExpect(status().isBadRequest());

        mvc.perform(get("/api/me").session(session)).andExpect(jsonPath("$.balance").value(10000));
        mvc.perform(get("/api/me/history").session(session)).andExpect(jsonPath("$.totalItems").value(0));
    }

    @Test
    @DisplayName("GET debug: scenariusze działają przez zwykły spin, z prawidłowym saldem i jedną pozycją historii")
    void advertisedScenariosUseNormalSpinAndWallet() throws Exception {
        int player = 0;
        for (String code : List.of("cebulowy-777", "zloty-faraon", "krysztalowa-kaskada")) {
            JsonNode debug = body(mvc.perform(get("/api/slots/" + code + "/debug")));
            assertThat(debug.get("enabled").asBoolean()).isTrue();
            List<String> expectedIds = switch (code) {
                case "cebulowy-777" -> List.of("wild-win");
                case "zloty-faraon" -> List.of("scatter", "bonus");
                default -> List.of("scatter", "bonus", "cascade");
            };
            assertThat(debug.get("scenarios").findValuesAsText("id")).containsExactlyElementsOf(expectedIds);
            long bet = code.equals("cebulowy-777") ? 10 : 20;
            for (JsonNode scenario : debug.get("scenarios")) {
                MockHttpSession session = login("Debug_API_" + (++player));
                String seed = scenario.get("seed").asText();
                assertThat(seed).matches("[0-9a-f]{16}");
                assertThat(scenario.get("label").asText()).isNotBlank();
                mvc.perform(get("/api/slots/" + code + "/debug").session(session)).andExpect(status().isOk());
                mvc.perform(get("/api/me/history").session(session)).andExpect(jsonPath("$.totalItems").value(0));
                mvc.perform(get("/api/me").session(session)).andExpect(jsonPath("$.balance").value(10000));

                JsonNode round = body(spin(session, code, bet, seed));
                assertThat(round.get("seed").asText()).isEqualTo(seed);
                assertThat(round.get("gameCode").asText()).isEqualTo(code);
                assertThat(round.get("balanceBefore").asLong()).isEqualTo(10000);
                long expectedBalance = 10000 - bet + round.get("totalWin").asLong();
                assertThat(round.get("balanceAfter").asLong()).isEqualTo(expectedBalance);
                assertThat(body(mvc.perform(get("/api/me").session(session))).get("balance").asLong())
                        .isEqualTo(expectedBalance);
                mvc.perform(get("/api/me/history").session(session)).andExpect(jsonPath("$.totalItems").value(1));
            }
        }
    }

    @Test
    @DisplayName("GET debug nieznanej gry zwraca 404 także przy włączonej fladze")
    void unknownDebugGame() throws Exception {
        mvc.perform(get("/api/slots/nie-ma/debug"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GAME_NOT_FOUND"));
    }}
