package pl.wsb.kasyno.report.web;

import pl.wsb.kasyno.slots.api.GamePopularity;

import java.math.BigDecimal;

/**
 * Pytanie inwestora 1: popularność gry w wybranym okresie ({@code GET /api/reports/popular-games?days=7}).
 */
public record PopularGameResponse(int rank, String gameCode, String gameName, long spins, BigDecimal totalWagered) {

    public static PopularGameResponse from(int rank, GamePopularity popularity) {
        return new PopularGameResponse(rank, popularity.gameCode(), popularity.gameName(), popularity.spins(),
                popularity.totalWagered());
    }
}
