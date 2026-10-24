package pl.wsb.kasyno.slots.web;

import pl.wsb.kasyno.slots.entity.SlotSymbol;
import pl.wsb.kasyno.slots.entity.SymbolKind;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Symbol w tabeli wypłat: {@code { "code": "siodemka", "kind": "NORMAL", "pays": { "3": 50 } }}.
 * {@code pays}: liczba symboli (linie) albo rozmiar klastra → mnożnik zakładu.
 */
public record SymbolResponse(String code, SymbolKind kind, Map<Integer, BigDecimal> pays) {

    public static SymbolResponse from(SlotSymbol symbol) {
        return new SymbolResponse(symbol.getCode(), symbol.getKind(), symbol.getPays().asMap());
    }
}
