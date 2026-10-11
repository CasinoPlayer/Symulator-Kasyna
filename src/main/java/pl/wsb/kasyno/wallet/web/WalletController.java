package pl.wsb.kasyno.wallet.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pl.wsb.kasyno.account.api.PlayerProfiles;
import pl.wsb.kasyno.shared.web.CurrentPlayer;
import pl.wsb.kasyno.shared.web.PageResponse;
import pl.wsb.kasyno.wallet.application.WalletService;

import java.math.BigDecimal;

/**
 * Portfel zalogowanego gracza: bonus ratunkowy i historia operacji (kontrakt § 2.1).
 *
 * <p>Parametry stronicowania mają adnotacje Bean Validation ({@code @Min}, {@code @Max}); Spring sprawdza je przed
 * wywołaniem metody, a przy błędzie zwraca {@code 400 VALIDATION_FAILED} z listą {@code errors}.
 */
@Tag(name = "Gracz")
@RestController
@RequestMapping("/api/me")
public class WalletController {

    private final WalletService walletService;
    private final PlayerProfiles playerProfiles;

    public WalletController(WalletService walletService, PlayerProfiles playerProfiles) {
        this.walletService = walletService;
        this.playerProfiles = playerProfiles;
    }

    @Operation(summary = "Bonus ratunkowy 10 000",
            description = "Dostępny, gdy saldo < minBet i od poprzedniego minęło 10 minut; inaczej 409 RESCUE_NOT_AVAILABLE.")
    @PostMapping("/rescue")
    public RescueResponse rescue(@CurrentPlayer Long playerId) {
        BigDecimal amount = walletService.rescue(playerId);
        return new RescueResponse(playerProfiles.view(playerId), amount);
    }

    @Operation(summary = "Historia operacji portfela (stronicowana)")
    @GetMapping("/transactions")
    public PageResponse<TransactionResponse> transactions(
            @CurrentPlayer Long playerId,
            @RequestParam(name = "page", defaultValue = "0") @Min(value = 0, message = "Numer strony nie może być ujemny") int page,
            @RequestParam(name = "size", defaultValue = "20")
            @Min(value = 1, message = "Rozmiar strony musi wynosić co najmniej 1")
            @Max(value = 100, message = "Rozmiar strony może wynosić najwyżej 100") int size) {
        return PageResponse.from(walletService.history(playerId, page, size), TransactionResponse::from);
    }
}
