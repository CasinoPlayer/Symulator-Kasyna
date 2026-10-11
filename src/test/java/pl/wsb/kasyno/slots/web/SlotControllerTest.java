package pl.wsb.kasyno.slots.web;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import pl.wsb.kasyno.shared.domain.Money;
import pl.wsb.kasyno.shared.web.PlayerSession;
import pl.wsb.kasyno.slots.application.GameNotReadyException;
import pl.wsb.kasyno.slots.application.IdempotencyConflictException;
import pl.wsb.kasyno.slots.application.PlayerSlotsService;
import pl.wsb.kasyno.slots.application.SlotCatalogService;
import pl.wsb.kasyno.slots.application.SpinCommand;
import pl.wsb.kasyno.slots.application.SpinResult;
import pl.wsb.kasyno.slots.application.SpinService;
import pl.wsb.kasyno.slots.domain.GameNotFoundException;
import pl.wsb.kasyno.slots.domain.InvalidBetException;
import pl.wsb.kasyno.slots.domain.Paylines;
import pl.wsb.kasyno.slots.domain.ReelStrips;
import pl.wsb.kasyno.slots.domain.SpinStatus;
import pl.wsb.kasyno.support.TestData;
import pl.wsb.kasyno.wallet.domain.InsufficientFundsException;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = {SlotController.class, PlayerSlotsController.class})
@ActiveProfiles("test")
@DisplayName("API automatów: katalog, spin i kody błędów")
class SlotControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private SlotCatalogService catalog;
    @MockitoBean
    private SpinService spinService;
    @MockitoBean
    private PlayerSlotsService playerSlots;

    private MockHttpSession session;

    @BeforeEach
    void setUp() {
        session = new MockHttpSession();
        session.setAttribute(PlayerSession.PLAYER_ID, 7L);
    }

    private org.springframework.test.web.servlet.ResultActions spin(String body) throws Exception {
        return mvc.perform(post("/api/slots/cebulowy-777/spins").session(session)
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test
    @DisplayName("GET /api/slots: kształt z kontraktu (betLevels jako liczby całkowite, lines=null dla klastrów)")
    void listsGames() throws Exception {
        when(catalog.activeMachines()).thenReturn(List.of(TestData.cebulowy777(), TestData.kaskada()));

        mvc.perform(get("/api/slots"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].code").value("cebulowy-777"))
                .andExpect(jsonPath("$[0].engineType").value("LINES"))
                .andExpect(jsonPath("$[0].lines").value(5))
                .andExpect(jsonPath("$[0].betLevels[0]").value(10))
                .andExpect(jsonPath("$[0].betLevels[6]").value(1000))
                .andExpect(jsonPath("$[0].minBet").value(10))
                .andExpect(jsonPath("$[0].maxBet").value(1000))
                .andExpect(jsonPath("$[0].targetRtp").value(95))
                .andExpect(jsonPath("$[0].volatility").value("LOW_MEDIUM"))
                .andExpect(jsonPath("$[1].engineType").value("CLUSTER"))
                .andExpect(jsonPath("$[1].lines").value(nullValue()));
    }

    @Test
    @DisplayName("GET /api/slots/{code} nieznanej gry → 404 GAME_NOT_FOUND")
    void unknownGame() throws Exception {
        when(catalog.machineWithSymbols("nie-ma")).thenThrow(new GameNotFoundException("nie-ma"));

        mvc.perform(get("/api/slots/nie-ma"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GAME_NOT_FOUND"));
    }

    @Test
    @DisplayName("spin bez sesji → 401 NOT_LOGGED_IN (serwis nie jest wołany)")
    void spinRequiresLogin() throws Exception {
        mvc.perform(post("/api/slots/cebulowy-777/spins").contentType(MediaType.APPLICATION_JSON).content("{\"bet\":100}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("NOT_LOGGED_IN"));
        verifyNoInteractions(spinService);
    }

    @Test
    @DisplayName("spin: brak zakładu → 400 VALIDATION_FAILED z polem bet")
    void spinValidation() throws Exception {
        spin("{}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[0].field").value("bet"));
        spin("{\"bet\":-10}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("bet"));
    }

    /**
     * {@code 1e999999999} to 11 znaków JSON-a, ale „w zapisie zwykłym” miliard cyfr. Przed poprawką przechodził
     * {@code @Positive}, a budowa komunikatu {@code BET_INVALID} kończyła się {@code OutOfMemoryError}.
     */
    @Test
    @DisplayName("spin: zakład 1e999999999 (miliard cyfr) → od razu 400 VALIDATION_FAILED, serwis nie jest wołany")
    void absurdBetIsRejectedByValidation() throws Exception {
        spin("{\"bet\":1e999999999}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[0].field").value("bet"));
        spin("{\"bet\":100.001}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("bet"));
        verifyNoInteractions(spinService);
    }

    @Test
    @DisplayName("równoległe żądanie (blokada portfela zajęta) → 409 CONCURRENT_REQUEST z Retry-After, nie 500")
    void lockTimeoutIsConflictNotServerError() throws Exception {
        doThrow(new CannotAcquireLockException("Timeout trying to lock table")).when(spinService).spin(any());

        spin("{\"bet\":100}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONCURRENT_REQUEST"))
                .andExpect(jsonPath("$.retryAfterSeconds").value(1))
                .andExpect(header().string("Retry-After", "1"))
                .andExpect(content().string(not(containsString("lock table"))));
    }

    @Test
    @DisplayName("spin: Idempotency-Key dłuższy niż 64 znaki → 400 VALIDATION_FAILED")
    void idempotencyKeyTooLong() throws Exception {
        mvc.perform(post("/api/slots/cebulowy-777/spins").session(session)
                        .header("Idempotency-Key", "x".repeat(65))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"bet\":100}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[0].field").value("Idempotency-Key"));
    }

    @Test
    @DisplayName("spin: kody błędów biznesowych (BET_INVALID, INSUFFICIENT_FUNDS, IDEMPOTENCY_CONFLICT, GAME_NOT_READY)")
    void businessErrorCodes() throws Exception {
        doThrow(new InvalidBetException(Money.of(7), TestData.cebulowy777().getBetLevels())).when(spinService).spin(any());
        spin("{\"bet\":7}").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("BET_INVALID"));

        doThrow(new InsufficientFundsException(Money.of(50), Money.of(100))).when(spinService).spin(any());
        spin("{\"bet\":100}").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INSUFFICIENT_FUNDS"));

        doThrow(new IdempotencyConflictException()).when(spinService).spin(any());
        spin("{\"bet\":100}").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("IDEMPOTENCY_CONFLICT"));

        doThrow(new GameNotReadyException("cebulowy-777")).when(spinService).spin(any());
        spin("{\"bet\":100}").andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("GAME_NOT_READY"));
    }

    /** Dokument rundy w kształcie z kontraktu § 2.4 (tak zapisuje go SpinService w resultJson). */
    private static final String ROUND_DOCUMENT = "{\"roundId\":100,\"gameCode\":\"cebulowy-777\",\"bet\":100,"
            + "\"totalWin\":2000,\"multiplier\":20,\"tier\":\"big\",\"balanceBefore\":10000,\"balanceAfter\":11900,"
            + "\"seed\":\"000000000000002a\",\"steps\":[{\"type\":\"spin\"}]}";

    private static SpinResult spinResult(boolean replayed) {
        return new SpinResult(100L, "cebulowy-777", Money.of(100), Money.of(2_000), Money.of(20), "big",
                SpinStatus.SETTLED, Money.of(11_900), replayed, ROUND_DOCUMENT, Instant.parse("2026-10-11T12:00:00Z"));
    }

    @Test
    @DisplayName("spin OK: przekazuje gracza, grę, zakład i klucz; odpowiedź = dokument rundy z kontraktu § 2.4")
    void spinOk() throws Exception {
        when(spinService.spin(any())).thenReturn(spinResult(false));

        mvc.perform(post("/api/slots/cebulowy-777/spins").session(session)
                        .header("Idempotency-Key", " 3f1c-uuid ")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"bet\":100}"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(content().json(ROUND_DOCUMENT, true))
                .andExpect(jsonPath("$.roundId").value(100))
                .andExpect(jsonPath("$.totalWin").value(2000))
                .andExpect(jsonPath("$.balanceAfter").value(11900))
                .andExpect(jsonPath("$.seed").value("000000000000002a"))
                .andExpect(jsonPath("$.steps[0].type").value("spin"))
                .andExpect(header().doesNotExist(SlotController.REPLAYED_HEADER));

        ArgumentCaptor<SpinCommand> command = ArgumentCaptor.forClass(SpinCommand.class);
        verify(spinService).spin(command.capture());
        assertThat(command.getValue().playerId()).isEqualTo(7L);
        assertThat(command.getValue().gameCode()).isEqualTo("cebulowy-777");
        assertThat(command.getValue().bet()).isEqualByComparingTo("100");
        assertThat(command.getValue().idempotencyKey()).isEqualTo("3f1c-uuid");
        assertThat(command.getValue().demoSeed()).isNull();
    }

    @Test
    @DisplayName("X-Demo-Seed poza profilem demo: nagłówek nie trafia do polecenia (ziarno zostaje losowe)")
    void demoSeedIgnoredOutsideDemo() throws Exception {
        when(spinService.spin(any())).thenReturn(spinResult(false));

        mvc.perform(post("/api/slots/cebulowy-777/spins").session(session)
                        .header(SlotController.DEMO_SEED_HEADER, "5f3a9c0e7b21d4a8")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"bet\":100}"))
                .andExpect(status().isOk());

        ArgumentCaptor<SpinCommand> command = ArgumentCaptor.forClass(SpinCommand.class);
        verify(spinService).spin(command.capture());
        assertThat(command.getValue().demoSeed()).isNull();
    }

    @Test
    @DisplayName("format X-Demo-Seed: szesnastkowo jak pole seed (z 0x lub bez), ffffffffffffffff = −1")
    void demoSeedFormat() {
        assertThat(SlotController.parseDemoSeed("000000000000002a")).isEqualTo(42L);
        assertThat(SlotController.parseDemoSeed(" 0x2A ")).isEqualTo(42L);
        assertThat(SlotController.parseDemoSeed("ffffffffffffffff")).isEqualTo(-1L);
        assertThat(SlotController.parseDemoSeed(null)).isNull();
        assertThat(SlotController.parseDemoSeed("  ")).isNull();
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> SlotController.parseDemoSeed("xyz"))
                .isInstanceOf(pl.wsb.kasyno.shared.error.CasinoException.class);
    }

    @Test
    @DisplayName("powtórka (ten sam Idempotency-Key): ta sama treść i nagłówek Idempotent-Replayed: true")
    void replayedSpinHasHeader() throws Exception {
        when(spinService.spin(any())).thenReturn(spinResult(true));

        spin("{\"bet\":100}")
                .andExpect(status().isOk())
                .andExpect(content().json(ROUND_DOCUMENT, true))
                .andExpect(header().string(SlotController.REPLAYED_HEADER, "true"));
    }

    @Test
    @DisplayName("GET /api/slots/{code}: gra liniowa ma paylines, symbole z pays i features")
    void detailsWithPaylines() throws Exception {
        var machine = TestData.cebulowy777();
        machine.defineReels(ReelStrips.parse("a,b,c|a,b,c|a,b,c"), null,
                Paylines.parse("1,1,1|0,0,0|2,2,2|0,1,2|2,1,0"));
        when(catalog.machineWithSymbols("cebulowy-777")).thenReturn(machine);

        mvc.perform(get("/api/slots/cebulowy-777"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paylines.length()").value(5))
                .andExpect(jsonPath("$.paylines[3]").value(contains(0, 1, 2)))
                .andExpect(jsonPath("$.features[1]").value("NEON JACKPOT ×10"));

        when(catalog.machineWithSymbols("krysztalowa-kaskada")).thenReturn(TestData.kaskada());
        mvc.perform(get("/api/slots/krysztalowa-kaskada"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paylines").doesNotExist());
    }

    @Test
    @DisplayName("historia: rozmiar strony > 100 → 400 VALIDATION_FAILED")
    void historyPageSizeLimit() throws Exception {
        mvc.perform(get("/api/me/history").param("size", "500").session(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[0].field").value("size"));
        mvc.perform(get("/api/me/history").param("page", "abc").session(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.detail").value("Parametr „page” ma niepoprawny format."));
    }

    @Test
    @DisplayName("historia: numer strony ponad limit (przepełnienie page × size) → 400, a nie 500")
    void historyPageNumberLimit() throws Exception {
        mvc.perform(get("/api/me/history").param("page", "2147483647").param("size", "100").session(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[0].field").value("page"));
        verifyNoInteractions(playerSlots);
    }

    @Test
    @DisplayName("nagłówki bezpieczeństwa w każdej odpowiedzi: nosniff, SAMEORIGIN, Referrer-Policy")
    void securityHeaders() throws Exception {
        when(catalog.activeMachines()).thenReturn(List.of());

        mvc.perform(get("/api/slots"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "SAMEORIGIN"))
                .andExpect(header().string("Referrer-Policy", "same-origin"));
    }
}
