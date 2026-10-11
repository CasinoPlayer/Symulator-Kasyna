package pl.wsb.kasyno.account.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.wsb.kasyno.account.api.PlayerProfiles;
import pl.wsb.kasyno.account.api.PlayerView;
import pl.wsb.kasyno.shared.web.CurrentPlayer;

/**
 * Bieżący gracz ({@code GET /api/me}). Front woła go po załadowaniu strony, żeby wiedzieć, czy ktoś jest zalogowany
 * (200 z obiektem {@code player}) czy pokazać przycisk „Zaloguj” (401 {@code NOT_LOGGED_IN}).
 */
@Tag(name = "Gracz")
@RestController
@RequestMapping("/api/me")
public class MeController {

    private final PlayerProfiles playerProfiles;

    public MeController(PlayerProfiles playerProfiles) {
        this.playerProfiles = playerProfiles;
    }

    @Operation(summary = "Zalogowany gracz i jego saldo")
    @GetMapping
    public PlayerView me(@CurrentPlayer Long playerId) {
        return playerProfiles.view(playerId);
    }
}
