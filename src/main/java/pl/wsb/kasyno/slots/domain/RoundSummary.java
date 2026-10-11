package pl.wsb.kasyno.slots.domain;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Lekki widok rundy do list (historia gracza, feed dużych wygranych): projekcja z zapytania JPQL
 * ({@code select new ...}), a nie encja {@link SpinRound}.
 *
 * <p>Po co: encja ma kolumnę {@code result_json} (CLOB z pełnym przebiegiem rundy: obrót, kaskady, darmowe spiny),
 * która przy Kryształowej Kaskadzie potrafi mieć dziesiątki kilobajtów. Listy jej nie potrzebują, a pobranie encji
 * czytałoby ją dla każdego wiersza (strona historii to do 100 rund, feed w lobby jest odpytywany co chwilę).
 * Projekcja wybiera tylko potrzebne kolumny, w jednym zapytaniu z nazwą gracza i gry (bez problemu N+1).
 *
 * @param roundId    identyfikator rundy
 * @param nick       nazwa gracza
 * @param gameCode   kod gry
 * @param gameName   nazwa gry
 * @param bet        zakład
 * @param win        łączna wygrana
 * @param multiplier wygrana jako wielokrotność zakładu
 * @param tier       poziom wygranej
 * @param status     status rundy
 * @param createdAt  kiedy runda się rozpoczęła (UTC)
 * @param settledAt  kiedy runda została rozliczona ({@code null}, gdy jeszcze nie)
 */
public record RoundSummary(
        Long roundId,
        String nick,
        String gameCode,
        String gameName,
        BigDecimal bet,
        BigDecimal win,
        BigDecimal multiplier,
        WinTier tier,
        SpinStatus status,
        Instant createdAt,
        Instant settledAt) {

    /** Chwila, którą pokazujemy na liście: rozliczenie rundy, a gdy go nie ma, jej start. */
    public Instant finishedAt() {
        return settledAt != null ? settledAt : createdAt;
    }
}
