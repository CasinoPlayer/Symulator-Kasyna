package pl.wsb.kasyno.account.web;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import pl.wsb.kasyno.account.api.PlayerProfiles;
import pl.wsb.kasyno.account.api.PlayerView;
import pl.wsb.kasyno.account.application.LoginResult;
import pl.wsb.kasyno.account.application.LoginService;
import pl.wsb.kasyno.account.domain.InvalidNickException;
import pl.wsb.kasyno.shared.domain.Money;
import pl.wsb.kasyno.shared.web.PlayerSession;

import java.math.BigDecimal;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Test warstwy web ({@code @WebMvcTest}): Spring uruchamia tylko kontrolery, obsługę błędów i konfigurację MVC,
 * a serwisy zastępujemy atrapami ({@code @MockitoBean}). MockMvc wysyła żądania bez prawdziwego serwera HTTP.
 */
@WebMvcTest(controllers = {AuthController.class, MeController.class})
@ActiveProfiles("test")
@DisplayName("API logowania i kody błędów")
class AuthControllerTest {

    private static final PlayerView KAMIL = new PlayerView(7L, "Kamil_77", 3, Money.of(10_000), Money.of(10),
            false, 0, Instant.parse("2026-10-11T12:00:00Z"));

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private LoginService loginService;
    @MockitoBean
    private PlayerProfiles playerProfiles;

    @Test
    @DisplayName("POST /api/auth/login: nowy gracz → 200, bonus 10000, gracz zapisany w sesji")
    void loginNewPlayer() throws Exception {
        when(loginService.login("Kamil_77")).thenReturn(new LoginResult(7L, true, Money.of(10_000)));
        when(playerProfiles.view(7L)).thenReturn(KAMIL);

        MvcResult result = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nick\":\"Kamil_77\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.newPlayer").value(true))
                .andExpect(jsonPath("$.welcomeBonus").value(10000))
                .andExpect(jsonPath("$.player.id").value(7))
                .andExpect(jsonPath("$.player.nick").value("Kamil_77"))
                .andExpect(jsonPath("$.player.avatarIndex").value(3))
                .andExpect(jsonPath("$.player.balance").value(10000))
                .andExpect(jsonPath("$.player.minBet").value(10))
                .andExpect(jsonPath("$.player.canRescue").value(false))
                .andExpect(jsonPath("$.player.createdAt").value("2026-10-11T12:00:00Z"))
                // kwoty jako liczby całkowite, bez „.00”
                .andExpect(content().string(containsString("\"balance\":10000,")))
                .andReturn();

        assertThat(result.getRequest().getSession(false)).isNotNull();
        assertThat(result.getRequest().getSession(false).getAttribute(PlayerSession.PLAYER_ID)).isEqualTo(7L);
    }

    @Test
    @DisplayName("niepoprawna nazwa → 400 NICK_INVALID w formacie problem+json")
    void invalidNick() throws Exception {
        when(loginService.login(anyString())).thenThrow(InvalidNickException.invalid("Nazwa gracza musi mieć od 3 do 16 znaków."));

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"nick\":\"ab\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("NICK_INVALID"))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail").value("Nazwa gracza musi mieć od 3 do 16 znaków."))
                .andExpect(jsonPath("$.type").value("/errors/nick-invalid"));
    }

    @Test
    @DisplayName("zakazana nazwa → 400 NICK_FORBIDDEN")
    void forbiddenNick() throws Exception {
        when(loginService.login(anyString())).thenThrow(InvalidNickException.forbidden());

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"nick\":\"admin\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("NICK_FORBIDDEN"));
    }

    @Test
    @DisplayName("zepsuty JSON → 400 VALIDATION_FAILED")
    void malformedJson() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{nick:"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.detail").value("Treść żądania nie jest poprawnym JSON-em albo któreś pole ma zły typ."));
    }

    @Test
    @DisplayName("ciało nie-JSON (np. formularz z obcej strony) → 415 z prośbą o application/json")
    void nonJsonBodyIsRejected() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_FORM_URLENCODED).content("nick=Kamil"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.detail").value("Dane wysyłaj jako JSON (nagłówek Content-Type: application/json)."));
    }

    @Test
    @DisplayName("GET /api/me bez sesji → 401 NOT_LOGGED_IN")
    void meWithoutSession() throws Exception {
        mvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("NOT_LOGGED_IN"));
    }

    @Test
    @DisplayName("GET /api/me z sesją → 200 i obiekt player")
    void meWithSession() throws Exception {
        when(playerProfiles.view(7L)).thenReturn(KAMIL);
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(PlayerSession.PLAYER_ID, 7L);

        mvc.perform(get("/api/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nick").value("Kamil_77"))
                .andExpect(jsonPath("$.rescueAvailableInSeconds").value(0));
    }

    @Test
    @DisplayName("POST /api/auth/logout → 204 i unieważniona sesja")
    void logout() throws Exception {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(PlayerSession.PLAYER_ID, 7L);

        mvc.perform(post("/api/auth/logout").session(session)).andExpect(status().isNoContent());

        assertThat(session.isInvalid()).isTrue();
    }

    @Test
    @DisplayName("nieoczekiwany błąd → 500 INTERNAL_ERROR bez szczegółów technicznych")
    void unexpectedErrorDoesNotLeak() throws Exception {
        when(loginService.login(anyString())).thenThrow(new IllegalStateException("tajny szczegół: SELECT * FROM ..."));

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"nick\":\"Kamil\"}"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(content().string(not(containsString("tajny"))))
                .andExpect(content().string(not(containsString("IllegalStateException"))));
    }

    @Test
    @DisplayName("nieznany adres → 404 z kodem NOT_FOUND")
    void unknownPath() throws Exception {
        mvc.perform(get("/api/nie-ma-takiego"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.detail").value("Nie ma takiego adresu."));
    }

    @Test
    @DisplayName("zła metoda HTTP → 405 z kodem METHOD_NOT_ALLOWED")
    void wrongMethod() throws Exception {
        mvc.perform(get("/api/auth/login"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
    }

    @Test
    @DisplayName("BigDecimal w JSON: 95.50 → 95.5, 0.00 → 0")
    void bigDecimalSerialization() throws Exception {
        when(playerProfiles.view(7L)).thenReturn(new PlayerView(7L, "Kamil_77", 3, new BigDecimal("95.50"),
                new BigDecimal("0.00"), true, 0, Instant.parse("2026-10-11T12:00:00Z")));
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(PlayerSession.PLAYER_ID, 7L);

        mvc.perform(get("/api/me").session(session))
                .andExpect(content().string(containsString("\"balance\":95.5,")))
                .andExpect(content().string(containsString("\"minBet\":0,")));
    }
}
