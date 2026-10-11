package pl.wsb.kasyno.slots.web;

import pl.wsb.kasyno.slots.domain.EngineType;
import pl.wsb.kasyno.slots.domain.SlotMachine;
import pl.wsb.kasyno.slots.domain.Volatility;

import java.math.BigDecimal;
import java.util.List;

/**
 * Gra na liście w lobby ({@code GET /api/slots}), kształt z kontraktu § 2.2.
 */
public record SlotSummaryResponse(
        String code,
        String name,
        EngineType engineType,
        int reels,
        int rows,
        Integer lines,
        List<BigDecimal> betLevels,
        BigDecimal minBet,
        BigDecimal maxBet,
        BigDecimal targetRtp,
        Volatility volatility) {

    public static SlotSummaryResponse from(SlotMachine machine) {
        return new SlotSummaryResponse(
                machine.getCode(),
                machine.getName(),
                machine.getEngineType(),
                machine.getReels(),
                machine.getRows(),
                machine.getLines(),
                machine.getBetLevels().asList(),
                machine.getMinBet(),
                machine.getMaxBet(),
                machine.getTargetRtp(),
                machine.getVolatility());
    }
}
