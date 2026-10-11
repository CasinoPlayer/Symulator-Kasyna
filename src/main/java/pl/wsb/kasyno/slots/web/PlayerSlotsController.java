package pl.wsb.kasyno.slots.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pl.wsb.kasyno.shared.web.CurrentPlayer;
import pl.wsb.kasyno.shared.web.PageResponse;
import pl.wsb.kasyno.slots.application.PlayerSlotsService;

import java.util.List;

/**
 * Historia rund i statystyki zalogowanego gracza ({@code /api/me/history}, {@code /api/me/stats}).
 * Adres zaczyna się od {@code /api/me}, ale dane należą do modułu automatów, więc kontroler jest tutaj.
 */
@Tag(name = "Gracz")
@RestController
@RequestMapping("/api/me")
public class PlayerSlotsController {

    private final PlayerSlotsService playerSlots;

    public PlayerSlotsController(PlayerSlotsService playerSlots) {
        this.playerSlots = playerSlots;
    }

    @Operation(summary = "Historia rund (stronicowana, od najnowszej)")
    @GetMapping("/history")
    public PageResponse<HistoryItemResponse> history(
            @CurrentPlayer Long playerId,
            @RequestParam(name = "page", defaultValue = "0")
            @Min(value = 0, message = "Numer strony nie może być ujemny")
            @Max(value = PageResponse.MAX_PAGE, message = "Numer strony jest za duży") int page,
            @RequestParam(name = "size", defaultValue = "20")
            @Min(value = 1, message = "Rozmiar strony musi wynosić co najmniej 1")
            @Max(value = PageResponse.MAX_SIZE, message = "Rozmiar strony może wynosić najwyżej 100") int size) {
        return PageResponse.from(playerSlots.history(playerId, page, size), HistoryItemResponse::from);
    }

    @Operation(summary = "Statystyki gracza na każdym automacie")
    @GetMapping("/stats")
    public List<MachineStatsResponse> stats(@CurrentPlayer Long playerId) {
        return playerSlots.stats(playerId).stream().map(MachineStatsResponse::from).toList();
    }
}
