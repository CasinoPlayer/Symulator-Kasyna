package pl.wsb.kasyno.slots.application.engine;

import java.math.BigDecimal;

/**
 * Wynik rundy policzony przez silnik gry.
 *
 * @param totalWin   łączna wygrana rundy w cebulionach (z kaskadami i darmowymi spinami; 0, gdy brak)
 * @param resultJson pełny przebieg rundy dla przeglądarki (kroki animacji; format w {@code docs/projekt/07})
 */
public record SpinOutcome(BigDecimal totalWin, String resultJson) {

    public SpinOutcome {
        if (totalWin == null || totalWin.signum() < 0) {
            throw new IllegalArgumentException("Wygrana nie może być ujemna ani pusta");
        }
        if (resultJson == null || resultJson.isBlank()) {
            throw new IllegalArgumentException("Silnik musi zwrócić przebieg rundy (JSON)");
        }
    }
}
