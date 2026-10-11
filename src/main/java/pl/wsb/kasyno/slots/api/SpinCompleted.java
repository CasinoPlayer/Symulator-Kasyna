package pl.wsb.kasyno.slots.api;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Zdarzenie: runda gry została rozliczona (status {@code SETTLED}).
 *
 * <p>Publikuje je {@code SpinService} na końcu spinu. Słuchacze reagują bez wiedzy serwisu spinu o nich:
 * {@code StatsUpdater} dolicza statystyki gracza na automacie (w tej samej transakcji), a w przyszłości
 * np. powiadomienia o dużych wygranych na żywo (LAB 06).
 *
 * @param roundId       identyfikator rundy
 * @param playerId      identyfikator gracza
 * @param slotMachineId identyfikator automatu
 * @param gameCode      kod gry
 * @param bet           zakład
 * @param win           wygrana (0, gdy brak)
 * @param multiplier    wygrana jako wielokrotność zakładu
 * @param tier          poziom wygranej ({@code none}, {@code small}, …, {@code ultra})
 * @param at            chwila rozliczenia (UTC)
 */
public record SpinCompleted(Long roundId, Long playerId, Long slotMachineId, String gameCode, BigDecimal bet,
                            BigDecimal win, BigDecimal multiplier, String tier, Instant at) {
}
