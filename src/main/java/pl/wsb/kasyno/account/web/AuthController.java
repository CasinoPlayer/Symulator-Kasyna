package pl.wsb.kasyno.account.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.wsb.kasyno.account.api.PlayerProfiles;
import pl.wsb.kasyno.account.application.LoginResult;
import pl.wsb.kasyno.account.application.LoginService;
import pl.wsb.kasyno.shared.web.PlayerSession;

/**
 * Logowanie nazwą gracza i wylogowanie ({@code /api/auth/*}, kontrakt § 2.1).
 */
@Tag(name = "Logowanie")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final LoginService loginService;
    private final PlayerProfiles playerProfiles;

    public AuthController(LoginService loginService, PlayerProfiles playerProfiles) {
        this.loginService = loginService;
        this.playerProfiles = playerProfiles;
    }

    @Operation(summary = "Wejście do kasyna nazwą gracza",
            description = "Znajduje gracza (bez rozróżniania wielkości liter) albo tworzy nowego z bonusem 10 000. "
                    + "Ustawia ciasteczko sesji.")
    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        LoginResult result = loginWithRetry(request.nick());
        PlayerSession.start(httpRequest, result.playerId());
        return new LoginResponse(playerProfiles.view(result.playerId()), result.newPlayer(), result.welcomeBonus());
    }

    @Operation(summary = "Wylogowanie", description = "Unieważnia sesję. Działa także bez sesji (zawsze 204).")
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest httpRequest) {
        PlayerSession.end(httpRequest);
        return ResponseEntity.noContent().build();
    }

    /**
     * Dwa równoczesne logowania nowego gracza (np. podwójne kliknięcie „Wejdź do kasyna”) mogą oba nie znaleźć
     * konta i oba spróbować je utworzyć. Unikalny e-mail w bazie odrzuci drugie, a my ponawiamy je raz:
     * za drugim razem konto już istnieje, więc gracz jest po prostu „powracający”.
     */
    private LoginResult loginWithRetry(String nick) {
        try {
            return loginService.login(nick);
        } catch (DataIntegrityViolationException concurrentRegistration) {
            return loginService.login(nick);
        }
    }
}
