package pl.wsb.kasyno.report.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pl.wsb.kasyno.report.application.InvestorReportService;
import pl.wsb.kasyno.slots.api.GamePopularity;

import java.util.List;
import java.util.stream.IntStream;

/**
 * Raporty „inwestora” ({@code /api/reports/*}, pięć pytań z planu § 5.5).
 *
 * <p>Raporty są publiczne (tylko dane zbiorcze, bez danych osobowych): świadome uproszczenie z kontraktu API
 * zamiast osobnego logowania administratora.
 */
@Tag(name = "Raporty inwestora")
@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final InvestorReportService reports;

    public ReportController(InvestorReportService reports) {
        this.reports = reports;
    }

    @Operation(summary = "1. Najpopularniejsze automaty w ostatnich N dniach")
    @GetMapping("/popular-games")
    public List<PopularGameResponse> popularGames(
            @RequestParam(name = "days", defaultValue = "7")
            @Min(value = 1, message = "Liczba dni musi wynosić co najmniej 1")
            @Max(value = 365, message = "Liczba dni może wynosić najwyżej 365") int days) {
        List<GamePopularity> games = reports.popularGames(days);
        return IntStream.range(0, games.size())
                .mapToObj(i -> PopularGameResponse.from(i + 1, games.get(i)))
                .toList();
    }

    @Operation(summary = "2. Rzeczywisty RTP automatów w porównaniu z docelowym")
    @GetMapping("/rtp")
    public List<RtpResponse> rtp() {
        return reports.rtp().stream().map(RtpResponse::from).toList();
    }

    @Operation(summary = "3. Liderzy: najlepszy bilans i największa pojedyncza wygrana")
    @GetMapping("/top-players")
    public TopPlayersResponse topPlayers(
            @RequestParam(name = "limit", defaultValue = "10")
            @Min(value = 1, message = "Limit musi wynosić co najmniej 1")
            @Max(value = 100, message = "Limit może wynosić najwyżej 100") int limit) {
        return TopPlayersResponse.from(reports.topPlayers(limit));
    }

    @Operation(summary = "4. Gospodarka: gracze „na zero” i cebuliony w obiegu")
    @GetMapping("/economy")
    public EconomyResponse economy() {
        return EconomyResponse.from(reports.economy());
    }

    @Operation(summary = "5. Godziny największej aktywności i średni zakład (UTC)")
    @GetMapping("/peak-hours")
    public List<PeakHourResponse> peakHours() {
        return reports.peakHours().stream().map(PeakHourResponse::from).toList();
    }
}
