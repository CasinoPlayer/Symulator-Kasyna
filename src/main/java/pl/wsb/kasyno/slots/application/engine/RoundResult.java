package pl.wsb.kasyno.slots.application.engine;

import java.util.List;

/**
 * Pełny wynik rundy policzony przez silnik, zanim zamienimy go na JSON.
 *
 * <p>Poza krokami animacji zawiera liczniki potrzebne testom matematyki (Monte Carlo): czy padły darmowe spiny,
 * ile ich zagrano, ile z nich wygrano i czy runda dobiła do limitu wygranej. Dzięki temu testy RTP sprawdzają
 * dokładnie ten sam kod, który działa w aplikacji, a nie jego osobną „uproszczoną” kopię.
 *
 * @param totalWin           łączna wygrana rundy w cebulionach (z darmowymi spinami, po limicie)
 * @param steps              kroki animacji w kolejności odgrywania
 * @param freeSpinsTriggered czy runda uruchomiła darmowe spiny
 * @param freeSpinsPlayed    ile darmowych spinów zagrano (z dodatkowymi)
 * @param freeSpinsWin       suma wygranych z darmowych spinów
 * @param maxWinReached      czy runda zakończyła się na limicie maksymalnej wygranej
 */
public record RoundResult(long totalWin, List<RoundStep> steps, boolean freeSpinsTriggered, int freeSpinsPlayed,
                          long freeSpinsWin, boolean maxWinReached) {

    public RoundResult {
        steps = List.copyOf(steps);
    }

    /** Wygrana z gry podstawowej (bez darmowych spinów). */
    public long baseWin() {
        return totalWin - freeSpinsWin;
    }
}
