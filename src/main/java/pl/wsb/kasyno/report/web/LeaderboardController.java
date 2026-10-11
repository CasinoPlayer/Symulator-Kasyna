package pl.wsb.kasyno.report.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pl.wsb.kasyno.account.api.PlayerAvatar;
import pl.wsb.kasyno.report.application.LeaderboardRow;
import pl.wsb.kasyno.report.application.LeaderboardService;
import pl.wsb.kasyno.report.application.LeaderboardType;

import java.util.List;
import java.util.stream.IntStream;

/**
 * Ranking i feed dużych wygranych do lobby ({@code /api/leaderboard}, {@code /api/feed/big-wins}).
 * Endpointy są publiczne: pokazują tylko nazwy graczy i wyniki, bez danych osobowych.
 */
@Tag(name = "Ranking")
@RestController
@RequestMapping("/api")
public class LeaderboardController {

    private final LeaderboardService leaderboardService;

    public LeaderboardController(LeaderboardService leaderboardService) {
        this.leaderboardService = leaderboardService;
    }

    @Operation(summary = "Ranking graczy", description = "type: biggest-win (największa wygrana) albo balance (saldo)")
    @GetMapping("/leaderboard")
    public List<LeaderboardEntryResponse> leaderboard(
            @RequestParam(name = "type", defaultValue = "biggest-win")
            @Pattern(regexp = "biggest-win|balance", message = "Dozwolone wartości: biggest-win, balance") String type,
            @RequestParam(name = "limit", defaultValue = "10")
            @Min(value = 1, message = "Limit musi wynosić co najmniej 1")
            @Max(value = 100, message = "Limit może wynosić najwyżej 100") int limit) {
        List<LeaderboardRow> rows = leaderboardService.leaderboard(LeaderboardType.fromParam(type), limit);
        // miejsce w rankingu to po prostu kolejność wierszy (od 1)
        return IntStream.range(0, rows.size())
                .mapToObj(i -> {
                    LeaderboardRow row = rows.get(i);
                    return new LeaderboardEntryResponse(i + 1, row.nick(), PlayerAvatar.indexFor(row.nick()),
                            row.value(), row.gameCode(), row.at());
                })
                .toList();
    }

    @Operation(summary = "Ostatnie duże wygrane (≥ 15× zakładu)")
    @GetMapping("/feed/big-wins")
    public List<BigWinResponse> bigWins(
            @RequestParam(name = "limit", defaultValue = "10")
            @Min(value = 1, message = "Limit musi wynosić co najmniej 1")
            @Max(value = 100, message = "Limit może wynosić najwyżej 100") int limit) {
        return leaderboardService.recentBigWins(limit).stream().map(BigWinResponse::from).toList();
    }
}
