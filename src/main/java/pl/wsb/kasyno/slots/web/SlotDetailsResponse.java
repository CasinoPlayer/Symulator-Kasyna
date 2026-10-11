package pl.wsb.kasyno.slots.web;

import pl.wsb.kasyno.slots.domain.EngineType;
import pl.wsb.kasyno.slots.domain.SlotMachine;
import pl.wsb.kasyno.slots.domain.Volatility;

import java.math.BigDecimal;
import java.util.List;

/**
 * Szczegóły gry ({@code GET /api/slots/{code}}): pola z listy gier plus tabela wypłat ({@code symbols})
 * i opis funkcji ({@code features}) do ekranu informacyjnego.
 */
public record SlotDetailsResponse(
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
        Volatility volatility,
        List<SymbolResponse> symbols,
        List<String> features) {

    public static SlotDetailsResponse from(SlotMachine machine) {
        return new SlotDetailsResponse(
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
                machine.getVolatility(),
                machine.getSymbols().stream().map(SymbolResponse::from).toList(),
                machine.getFeatureList());
    }
}
