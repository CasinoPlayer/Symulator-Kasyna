package pl.wsb.kasyno.slots.web;

import pl.wsb.kasyno.slots.domain.SpinRound;
import pl.wsb.kasyno.slots.domain.SpinStatus;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Element historii rund gracza ({@code GET /api/me/history}).
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

    public static HistoryItemResponse from(SpinRound round) {
        return new HistoryItemResponse(
                round.getId(),
                round.getSlotMachine().getCode(),
                round.getSlotMachine().getName(),
                round.getBet(),
                round.getTotalWin(),
                round.getMultiplier(),
                round.getTier().code(),
                round.getStatus(),
                round.getCreatedAt());
    }
}
