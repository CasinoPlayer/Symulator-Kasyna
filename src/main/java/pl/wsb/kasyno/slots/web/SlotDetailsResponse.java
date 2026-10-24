package pl.wsb.kasyno.slots.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import pl.wsb.kasyno.slots.entity.EngineType;
import pl.wsb.kasyno.slots.entity.SlotMachine;
import pl.wsb.kasyno.slots.entity.Volatility;

import java.math.BigDecimal;
import java.util.List;

/**
 * Szczegóły gry ({@code GET /api/slots/{code}}): pola z listy gier plus tabela wypłat ({@code symbols}),
 * opis funkcji ({@code features}) do ekranu informacyjnego i, dla gier liniowych, linie wygrywające
 * ({@code paylines}: dla każdej linii indeksy rzędów kolejnych bębnów, 0 = górny; pole pomijane w grze klastrowej).
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
        @JsonInclude(JsonInclude.Include.NON_NULL) List<List<Integer>> paylines,
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
                machine.getPaylines() == null ? null : machine.getPaylines().asList(),
                machine.getSymbols().stream().map(SymbolResponse::from).toList(),
                machine.getFeatureList());
    }
}
