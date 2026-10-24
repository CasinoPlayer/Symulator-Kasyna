package pl.wsb.kasyno.slots.web;

import pl.wsb.kasyno.slots.entity.PlayerMachineStats;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Statystyki gracza na jednym automacie ({@code GET /api/me/stats}).
 */
public record MachineStatsResponse(
        String gameCode,
        String gameName,
        long spins,
        BigDecimal totalWagered,
        BigDecimal totalWon,
        BigDecimal biggestWin,
        Instant lastPlayedAt) {

    public static MachineStatsResponse from(PlayerMachineStats stats) {
        return new MachineStatsResponse(
                stats.getSlotMachine().getCode(),
                stats.getSlotMachine().getName(),
                stats.getSpins(),
                stats.getTotalWagered(),
                stats.getTotalWon(),
                stats.getBiggestWin(),
                stats.getLastPlayedAt());
    }
}
