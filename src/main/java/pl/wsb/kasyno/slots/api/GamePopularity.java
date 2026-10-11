package pl.wsb.kasyno.slots.api;

import java.math.BigDecimal;

/**
 * Pytanie inwestora 1: popularność automatu (liczba rozegranych rund w wybranym okresie).
 * Rekord jest projekcją z zapytania JPQL ({@code select new ...}); dla gry bez rund baza zwraca {@code null}
 * w sumie, więc kompaktowy konstruktor zamienia go na zero.
 *
 * @param gameCode     kod gry
 * @param gameName     nazwa gry
 * @param spins        liczba rund
 * @param totalWagered suma zakładów
 */
public record GamePopularity(String gameCode, String gameName, Long spins, BigDecimal totalWagered) {

    public GamePopularity {
        spins = spins == null ? 0L : spins;
        totalWagered = totalWagered == null ? BigDecimal.ZERO : totalWagered;
    }
}
