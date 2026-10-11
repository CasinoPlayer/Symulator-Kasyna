package pl.wsb.kasyno.slots.web;

import pl.wsb.kasyno.slots.domain.RoundSummary;
import pl.wsb.kasyno.slots.domain.SpinStatus;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Element historii rund gracza ({@code GET /api/me/history}):
 * {@code { "roundId", "gameCode", "gameName", "bet", "win", "multiplier", "tier", "status", "createdAt" }}.
 */
public record HistoryItemResponse(
        Long roundId,
        String gameCode,
        String gameName,
        BigDecimal bet,
        BigDecimal win,
        BigDecimal multiplier,
        String tier,
        SpinStatus status,
        Instant createdAt) {

    /** Mapowanie projekcji na kształt z kontraktu API (poziom wygranej małymi literami: {@code big}). */
    public static HistoryItemResponse from(RoundSummary round) {
        return new HistoryItemResponse(
                round.roundId(),
                round.gameCode(),
                round.gameName(),
                round.bet(),
                round.win(),
                round.multiplier(),
                round.tier().code(),
                round.status(),
                round.createdAt());
    }
}
