package pl.wsb.kasyno.wallet.web;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import pl.wsb.kasyno.account.api.PlayerProfiles;
import pl.wsb.kasyno.account.api.PlayerView;
import pl.wsb.kasyno.shared.domain.Money;
import pl.wsb.kasyno.shared.web.PlayerSession;
import pl.wsb.kasyno.support.TestData;
import pl.wsb.kasyno.wallet.application.WalletService;
import pl.wsb.kasyno.wallet.domain.RescueNotAvailableException;
import pl.wsb.kasyno.wallet.domain.TransactionType;
import pl.wsb.kasyno.wallet.domain.Wallet;
import pl.wsb.kasyno.wallet.domain.WalletTransaction;

import java.time.Instant;
import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = WalletController.class)
@ActiveProfiles("test")
@DisplayName("API portfela: bonus ratunkowy i historia")
class WalletControllerTest {

    private static final Instant NOW = Instant.parse("2026-10-11T12:00:00Z");

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private WalletService walletService;
    @MockitoBean
    private PlayerProfiles playerProfiles;

    private MockHttpSession session;

    @BeforeEach
    void setUp() {
        session = new MockHttpSession();
        session.setAttribute(PlayerSession.PLAYER_ID, 7L);
    }

    @Test
    @DisplayName("rescue w trakcie odliczania → 409 RESCUE_NOT_AVAILABLE z retryAfterSeconds i nagłówkiem Retry-After")
    void rescueCoolingDown() throws Exception {
        when(walletService.rescue(7L)).thenThrow(RescueNotAvailableException.coolingDown(420));

        mvc.perform(post("/api/me/rescue").session(session))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("RESCUE_NOT_AVAILABLE"))
                .andExpect(jsonPath("$.retryAfterSeconds").value(420))
                .andExpect(header().string("Retry-After", "420"));
    }

    @Test
    @DisplayName("rescue przy wystarczającym saldzie → 409 bez retryAfterSeconds")
    void rescueBalanceTooHigh() throws Exception {
        when(walletService.rescue(7L)).thenThrow(RescueNotAvailableException.balanceTooHigh());

        mvc.perform(post("/api/me/rescue").session(session))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("RESCUE_NOT_AVAILABLE"))
                .andExpect(jsonPath("$.retryAfterSeconds").doesNotExist());
    }

    @Test
    @DisplayName("rescue OK → { player, amount }")
    void rescueOk() throws Exception {
        when(walletService.rescue(7L)).thenReturn(Money.of(10_000));
        when(playerProfiles.view(7L)).thenReturn(new PlayerView(7L, "Kamil", 1, Money.of(10_005), Money.of(10),
                false, 0, NOW));

        mvc.perform(post("/api/me/rescue").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(10000))
                .andExpect(jsonPath("$.player.balance").value(10005));
    }

    @Test
    @DisplayName("GET /api/me/transactions: strona { items, page, size, totalItems, totalPages }, BET ujemny")
    void transactionsPage() throws Exception {
        Wallet wallet = new Wallet(TestData.player("Kamil"), NOW);
        WalletTransaction bonus = wallet.credit(TransactionType.WELCOME_BONUS, Money.of(10_000), null, null, NOW);
        WalletTransaction bet = wallet.debitBet(Money.of(100), "cebulowy-777", 5L, NOW);
        when(walletService.history(7L, 0, 2)).thenReturn(new PageImpl<>(List.of(bet, bonus), PageRequest.of(0, 2), 3));

        mvc.perform(get("/api/me/transactions").param("page", "0").param("size", "2").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].type").value("BET"))
                .andExpect(jsonPath("$.items[0].amount").value(-100))
                .andExpect(jsonPath("$.items[0].balanceAfter").value(9900))
                .andExpect(jsonPath("$.items[0].gameCode").value("cebulowy-777"))
                .andExpect(jsonPath("$.items[0].roundId").value(5))
                .andExpect(jsonPath("$.items[1].type").value("WELCOME_BONUS"))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.totalItems").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
    }

    @Test
    @DisplayName("historia bez sesji → 401")
    void transactionsRequireLogin() throws Exception {
        mvc.perform(get("/api/me/transactions"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("NOT_LOGGED_IN"));
    }
}
