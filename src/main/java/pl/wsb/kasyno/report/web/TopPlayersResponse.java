package pl.wsb.kasyno.report.web;

import pl.wsb.kasyno.account.api.PlayerAvatar;
import pl.wsb.kasyno.report.application.TopPlayersReport;
import pl.wsb.kasyno.slots.api.PlayerResult;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.IntStream;

/**
 * Pytanie inwestora 3 ({@code GET /api/reports/top-players}): dwie listy graczy, według bilansu
 * i według największej pojedynczej wygranej.
 */
public record TopPlayersResponse(List<Entry> byNetResult, List<Entry> byBiggestWin) {

    /** Gracz w rankingu z wynikami zsumowanymi po wszystkich automatach. */
    public record Entry(int rank, String nick, int avatarIndex, long spins, BigDecimal totalWagered,
                        BigDecimal totalWon, BigDecimal netResult, BigDecimal biggestWin) {
    }

    public static TopPlayersResponse from(TopPlayersReport report) {
        return new TopPlayersResponse(ranked(report.byNetResult()), ranked(report.byBiggestWin()));
    }

    private static List<Entry> ranked(List<PlayerResult> results) {
        return IntStream.range(0, results.size())
                .mapToObj(i -> {
                    PlayerResult r = results.get(i);
                    return new Entry(i + 1, r.nick(), PlayerAvatar.indexFor(r.nick()), r.spins(), r.totalWagered(),
                            r.totalWon(), r.netResult(), r.biggestWin());
                })
                .toList();
    }
}
