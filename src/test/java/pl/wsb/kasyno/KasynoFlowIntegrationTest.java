package pl.wsb.kasyno;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.convention.TestBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import pl.wsb.kasyno.account.application.LoginService;
import pl.wsb.kasyno.slots.application.SpinCommand;
import pl.wsb.kasyno.slots.application.SpinService;
import pl.wsb.kasyno.slots.application.engine.FakeSlotEngine;
import pl.wsb.kasyno.slots.application.engine.SlotEngine;
import pl.wsb.kasyno.slots.web.SlotController;
import pl.wsb.kasyno.support.MutableClock;
import pl.wsb.kasyno.wallet.api.WalletFacade;
import pl.wsb.kasyno.wallet.entity.InsufficientFundsException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Test całej aplikacji (wszystkie warstwy, prawdziwa baza H2 w pamięci, {@code data.sql} z trzema automatami):
 * logowanie → bonus → spin → historia → ranking → raporty → bankructwo → bonus ratunkowy.
 *
 * <p>Żeby salda były przewidywalne, prawdziwy silnik gry {@code cebulowy-777} podmieniamy ({@code @TestBean})
 * na {@link FakeSlotEngine} z zaplanowanymi wygranymi; prawdziwe silniki w pełnym przepływie sprawdza
 * {@code SlotEnginesIntegrationTest}. Zegar to {@link MutableClock}, żeby sprawdzić odliczanie bonusu ratunkowego
 * bez czekania 10 minut.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(KasynoFlowIntegrationTest.TestBeans.class)
@DisplayName("Pełny przepływ gracza (integracja wszystkich warstw)")
class KasynoFlowIntegrationTest {

    private static final Instant START = Instant.parse("2026-10-11T12:00:00Z");

    private static final FakeSlotEngine FAKE_CEBULOWY_ENGINE = new FakeSlotEngine("cebulowy-777");

    @TestConfiguration
    static class TestBeans {

        /** {@code @Primary}: wygrywa z zegarem systemowym z {@code TimeConfig} przy wstrzykiwaniu {@code Clock}. */
        @Bean
        @Primary
        MutableClock testClock() {
            return new MutableClock(START);
        }
    }

    /** Bean {@code cebulowy777Engine} z {@code SlotEnginesConfig} zastąpiony fałszywym silnikiem. */
    @TestBean(name = "cebulowy777Engine", methodName = "fakeCebulowyEngine")
    private SlotEngine cebulowyEngine;

    static SlotEngine fakeCebulowyEngine() {
        return FAKE_CEBULOWY_ENGINE;
    }

    private final FakeSlotEngine engine = FAKE_CEBULOWY_ENGINE;

    @Autowired
    private MockMvc mvc;
    @Autowired
    private MutableClock clock;
    @Autowired
    private LoginService loginService;
    @Autowired
    private SpinService spinService;
    @Autowired
    private WalletFacade walletFacade;

    @BeforeEach
    void setUp() {
        engine.reset();
        clock.set(START);
    }

    private MockHttpSession login(String nick, boolean expectNew) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nick\":\"" + nick + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.newPlayer").value(expectNew))
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private ResultActions spin(MockHttpSession session, String game, long bet, String key) throws Exception {
        var request = post("/api/slots/" + game + "/spins").session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"bet\":" + bet + "}");
        if (key != null) {
            request.header("Idempotency-Key", key);
        }
        return mvc.perform(request);
    }

    private static Number number(MvcResult result, String path) throws Exception {
        return JsonPath.read(result.getResponse().getContentAsString(), path);
    }

    @Test
    @DisplayName("logowanie → spin z wygraną → idempotencja → historia, ranking, feed, raporty")
    void playerJourney() throws Exception {
        MockHttpSession session = login("Gracz_Testowy", true);
        login("GRACZ_testowy", false);

        mvc.perform(get("/api/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nick").value("Gracz_Testowy"))
                .andExpect(jsonPath("$.balance").value(10000))
                .andExpect(jsonPath("$.minBet").value(10));

        mvc.perform(post("/api/me/rescue").session(session))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("RESCUE_NOT_AVAILABLE"));

        // feed i ranking trafiają do pamięci podręcznej JESZCZE PRZED spinem; po zatwierdzonym spinie muszą pokazać
        // wygraną od razu (unieważnia je zdarzenie po commicie: LobbyBoardsListener, @TransactionalEventListener)
        mvc.perform(get("/api/feed/big-wins")).andExpect(jsonPath("$[?(@.nick == 'Gracz_Testowy')]").isEmpty());
        mvc.perform(get("/api/leaderboard").param("type", "biggest-win"))
                .andExpect(jsonPath("$[?(@.nick == 'Gracz_Testowy')]").isEmpty());

        engine.willWin(2_000);
        MvcResult first = spin(session, "cebulowy-777", 100, "klucz-1")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalWin").value(2000))
                .andExpect(jsonPath("$.multiplier").value(20))
                .andExpect(jsonPath("$.tier").value("big"))
                .andExpect(jsonPath("$.balanceBefore").value(10000))
                .andExpect(jsonPath("$.balanceAfter").value(11900))
                .andExpect(jsonPath("$.seed").isString())
                .andExpect(jsonPath("$.steps").isArray())
                .andExpect(header().doesNotExist(SlotController.REPLAYED_HEADER))
                .andReturn();
        long roundId = number(first, "$.roundId").longValue();

        // podwójne kliknięcie: ten sam klucz → ta sama runda (identyczna odpowiedź), bez drugiego zakładu
        spin(session, "cebulowy-777", 100, "klucz-1")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roundId").value(roundId))
                .andExpect(header().string(SlotController.REPLAYED_HEADER, "true"))
                .andExpect(content().string(first.getResponse().getContentAsString()));
        assertThat(engine.calls()).hasSize(1);

        spin(session, "cebulowy-777", 200, "klucz-1")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_CONFLICT"));
        spin(session, "cebulowy-777", 7, null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BET_INVALID"));

        mvc.perform(get("/api/me/history").session(session))
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].gameName").value("Cebulowy 777"))
                .andExpect(jsonPath("$.items[0].status").value("SETTLED"))
                .andExpect(jsonPath("$.items[0].win").value(2000));
        mvc.perform(get("/api/me/stats").session(session))
                .andExpect(jsonPath("$[0].gameCode").value("cebulowy-777"))
                .andExpect(jsonPath("$[0].spins").value(1))
                .andExpect(jsonPath("$[0].totalWagered").value(100))
                .andExpect(jsonPath("$[0].biggestWin").value(2000));
        mvc.perform(get("/api/me/transactions").session(session))
                .andExpect(jsonPath("$.totalItems").value(3))
                .andExpect(jsonPath("$.items[0].type").value("WIN"))
                .andExpect(jsonPath("$.items[0].balanceAfter").value(11900))
                .andExpect(jsonPath("$.items[0].roundId").value(roundId))
                .andExpect(jsonPath("$.items[1].type").value("BET"))
                .andExpect(jsonPath("$.items[1].amount").value(-100))
                .andExpect(jsonPath("$.items[2].type").value("WELCOME_BONUS"));

        // w rankingu są też gracze pokazowi z data.sql (LAB 02), więc szukamy wpisu gracza po nicku
        mvc.perform(get("/api/leaderboard").param("type", "biggest-win"))
                .andExpect(jsonPath("$[0].rank").value(1))
                .andExpect(jsonPath("$[?(@.nick == 'Gracz_Testowy')].value").value(2000))
                .andExpect(jsonPath("$[?(@.nick == 'Gracz_Testowy')].gameCode").value("cebulowy-777"));
        mvc.perform(get("/api/leaderboard").param("type", "balance"))
                .andExpect(jsonPath("$[0].value").isNumber());
        mvc.perform(get("/api/feed/big-wins"))
                .andExpect(jsonPath("$[?(@.nick == 'Gracz_Testowy')].gameName").value("Cebulowy 777"))
                .andExpect(jsonPath("$[?(@.nick == 'Gracz_Testowy')].tier").value("big"));

        mvc.perform(get("/api/reports/popular-games"))
                .andExpect(jsonPath("$[0].gameCode").value("cebulowy-777"));
        mvc.perform(get("/api/reports/rtp"))
                .andExpect(jsonPath("$[0].gameCode").value("cebulowy-777"))
                .andExpect(jsonPath("$[0].targetRtp").value(95));
        mvc.perform(get("/api/reports/top-players"))
                .andExpect(jsonPath("$.byBiggestWin[0].nick").isString());
        mvc.perform(get("/api/reports/economy"))
                .andExpect(jsonPath("$.players").isNumber())
                .andExpect(jsonPath("$.totalWelcomeBonus").isNumber());
        mvc.perform(get("/api/reports/peak-hours"))
                .andExpect(jsonPath("$[0].hour").value(12));
    }

    @Test
    @DisplayName("bankructwo → bonus ratunkowy → odliczanie 10 minut (zegar testowy)")
    void bankruptcyAndRescue() throws Exception {
        MockHttpSession session = login("Bankrut_1", true);

        for (int i = 0; i < 10; i++) {
            spin(session, "cebulowy-777", 1000, null).andExpect(status().isOk());
        }
        spin(session, "cebulowy-777", 10, null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INSUFFICIENT_FUNDS"));
        // nieudany spin nie zostawia rundy (transakcja wycofana razem z zakładem)
        mvc.perform(get("/api/me/history").session(session)).andExpect(jsonPath("$.totalItems").value(10));

        mvc.perform(get("/api/me").session(session))
                .andExpect(jsonPath("$.balance").value(0))
                .andExpect(jsonPath("$.canRescue").value(true));
        mvc.perform(post("/api/me/rescue").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(10000))
                .andExpect(jsonPath("$.player.balance").value(10000));

        for (int i = 0; i < 10; i++) {
            spin(session, "cebulowy-777", 1000, null).andExpect(status().isOk());
        }
        clock.advance(Duration.ofMinutes(4));
        mvc.perform(post("/api/me/rescue").session(session))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("RESCUE_NOT_AVAILABLE"))
                .andExpect(jsonPath("$.retryAfterSeconds").value(360));
        mvc.perform(get("/api/me").session(session))
                .andExpect(jsonPath("$.canRescue").value(false))
                .andExpect(jsonPath("$.rescueAvailableInSeconds").value(360));

        clock.advance(Duration.ofMinutes(6));
        mvc.perform(post("/api/me/rescue").session(session)).andExpect(status().isOk());
        mvc.perform(get("/api/reports/economy"))
                .andExpect(jsonPath("$.totalRescueBonus").isNumber());
    }

    @Test
    @DisplayName("16 równoległych spinów po 1000 przy saldzie 10 000: dokładnie 10 przechodzi, saldo nigdy ujemne")
    void concurrentSpinsNeverOverdraw() throws Exception {
        Long playerId = loginService.login("Rownolegly").playerId();
        int threads = 16;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Boolean>> results = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            results.add(pool.submit(() -> {
                start.await();
                try {
                    spinService.spin(new SpinCommand(playerId, "cebulowy-777", BigDecimal.valueOf(1000), null));
                    return true;
                } catch (InsufficientFundsException expected) {
                    return false;
                }
            }));
        }
        start.countDown();
        int succeeded = 0;
        for (Future<Boolean> result : results) {
            succeeded += result.get(30, TimeUnit.SECONDS) ? 1 : 0;
        }
        pool.shutdown();

        // blokada pesymistyczna portfela szereguje spiny: każdy widzi saldo po poprzednim
        assertThat(succeeded).isEqualTo(10);
        assertThat(walletFacade.balance(playerId)).isEqualByComparingTo("0");
    }

    /**
     * Podwójne (tu: ośmiokrotne) kliknięcie „SPIN” z tym samym kluczem, wysłane naprawdę równolegle. Spiny gracza
     * czekają w kolejce na blokadę portfela, więc tylko pierwsze losuje i pobiera zakład, a reszta dostaje powtórkę
     * tej samej rundy, bez błędów 500 i bez opierania się na wyjątku z unikalnego indeksu.
     */
    @Test
    @DisplayName("8 równoległych spinów z tym samym Idempotency-Key: jeden zakład, jedna runda, 7 powtórek")
    void concurrentDuplicateSpinsAreReplayed() throws Exception {
        MockHttpSession session = login("Dubel_Klik", true);
        int threads = 8;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<MvcResult>> results = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            results.add(pool.submit(() -> {
                start.await();
                return spin(session, "cebulowy-777", 100, "ten-sam-klucz").andReturn();
            }));
        }
        start.countDown();
        List<Long> roundIds = new ArrayList<>();
        int fresh = 0;
        for (Future<MvcResult> future : results) {
            MvcResult result = future.get(30, TimeUnit.SECONDS);
            assertThat(result.getResponse().getStatus()).isEqualTo(200);
            roundIds.add(number(result, "$.roundId").longValue());
            boolean replayed = "true".equals(result.getResponse().getHeader(SlotController.REPLAYED_HEADER));
            fresh += replayed ? 0 : 1;
        }
        pool.shutdown();

        assertThat(fresh).isEqualTo(1);
        assertThat(roundIds).containsOnly(roundIds.getFirst());
        assertThat(engine.calls()).hasSize(1);
        mvc.perform(get("/api/me").session(session)).andExpect(jsonPath("$.balance").value(9900));
        mvc.perform(get("/api/me/history").session(session)).andExpect(jsonPath("$.totalItems").value(1));
    }

    /** Podwójne kliknięcie „Wejdź do kasyna” nowym graczem: jedno konto, jeden bonus powitalny. */
    @Test
    @DisplayName("8 równoległych logowań nowym nickiem: jedno konto, jeden bonus powitalny, wszystkie 200")
    void concurrentFirstLoginsCreateOneAccount() throws Exception {
        int threads = 8;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<MvcResult>> results = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            results.add(pool.submit(() -> {
                start.await();
                return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nick\":\"Rownoczesny\"}")).andReturn();
            }));
        }
        start.countDown();
        List<Long> playerIds = new ArrayList<>();
        int newPlayers = 0;
        MockHttpSession anySession = null;
        for (Future<MvcResult> future : results) {
            MvcResult result = future.get(30, TimeUnit.SECONDS);
            assertThat(result.getResponse().getStatus()).isEqualTo(200);
            playerIds.add(number(result, "$.player.id").longValue());
            boolean isNew = JsonPath.read(result.getResponse().getContentAsString(), "$.newPlayer");
            newPlayers += isNew ? 1 : 0;
            anySession = (MockHttpSession) result.getRequest().getSession(false);
        }
        pool.shutdown();

        assertThat(newPlayers).isEqualTo(1);
        assertThat(playerIds).containsOnly(playerIds.getFirst());
        mvc.perform(get("/api/me/transactions").session(anySession))
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].type").value("WELCOME_BONUS"));
    }

    @Test
    @DisplayName("wylogowanie: sesja unieważniona, potem 401 NOT_LOGGED_IN")
    void logout() throws Exception {
        MockHttpSession session = login("Wylogowany", true);

        mvc.perform(post("/api/auth/logout").session(session)).andExpect(status().isNoContent());

        assertThat(session.isInvalid()).isTrue();
        mvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("NOT_LOGGED_IN"));
    }

    @Test
    @DisplayName("katalog gier z data.sql: 3 automaty zgodne z briefem")
    void catalogFromDataSql() throws Exception {
        mvc.perform(get("/api/slots"))
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].code").value("cebulowy-777"))
                .andExpect(jsonPath("$[1].code").value("zloty-faraon"))
                .andExpect(jsonPath("$[1].lines").value(20))
                .andExpect(jsonPath("$[2].code").value("krysztalowa-kaskada"))
                .andExpect(jsonPath("$[2].engineType").value("CLUSTER"));
        mvc.perform(get("/api/slots/zloty-faraon"))
                .andExpect(jsonPath("$.name").value("Złoty Faraon"))
                .andExpect(jsonPath("$.features.length()").value(6))
                .andExpect(jsonPath("$.symbols.length()").value(12))
                .andExpect(jsonPath("$.paylines.length()").value(20));
    }
}
