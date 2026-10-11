package pl.wsb.kasyno.slots.application.engine;

import java.util.ArrayList;
import java.util.List;

/**
 * Zbiera kroki jednej rundy i pilnuje sumy wygranej oraz limitu maksymalnej wygranej.
 *
 * <p>Po co: wszystkie miejsca, które dodają wygraną (linie, klastry, NEON JACKPOT, kule mnożników), przechodzą przez
 * {@link #addWin(long)}. Dzięki temu suma narastająca {@code totalWin} w krokach jest zawsze spójna z wynikiem rundy,
 * a limit (np. 5 000× zakładu w Złotym Faraonie) jest sprawdzany w jednym miejscu: kwota ponad limit jest ucinana,
 * runda dostaje krok {@code feature} {@code maxWin} i silnik kończy ją (bez dalszych kaskad i darmowych spinów).
 * Ograniczenie wygranej to standard w automatach: zamyka „ogon” rozkładu, więc najgorszy przypadek dla kasyna jest znany.
 */
final class RoundBuilder {

    private final long maxWin;
    private final int maxWinMultiplier;
    private final List<RoundStep> steps = new ArrayList<>();
    private long totalWin;
    private boolean maxWinReached;
    private boolean freeSpinsTriggered;
    private int freeSpinsPlayed;
    private long freeSpinsWin;

    RoundBuilder(long bet, int maxWinMultiplier) {
        this.maxWin = Math.multiplyExact(bet, maxWinMultiplier);
        this.maxWinMultiplier = maxWinMultiplier;
    }

    void add(RoundStep step) {
        steps.add(step);
    }

    /**
     * Dolicza wygraną z uwzględnieniem limitu.
     *
     * @return kwota faktycznie dodana (mniejsza od {@code amount}, gdy limit został osiągnięty)
     */
    long addWin(long amount) {
        long allowed = Math.min(amount, maxWin - totalWin);
        totalWin += allowed;
        if (totalWin >= maxWin) {
            maxWinReached = true;
        }
        return allowed;
    }

    /** Wygrana zdobyta w darmowym spinie (do podsumowania {@code freeSpinsEnd}). */
    void addFreeSpinsWin(long amount) {
        freeSpinsWin += amount;
    }

    /** Jeśli limit został osiągnięty, dopisuje krok {@code feature maxWin} i zwraca {@code true} (koniec rundy). */
    boolean stopAtMaxWin() {
        if (maxWinReached) {
            steps.add(new RoundStep.Feature(RoundStep.MAX_WIN, maxWinMultiplier, null, null));
        }
        return maxWinReached;
    }

    boolean maxWinReached() {
        return maxWinReached;
    }

    void freeSpinsTriggered() {
        freeSpinsTriggered = true;
    }

    void freeSpinPlayed() {
        freeSpinsPlayed++;
    }

    long totalWin() {
        return totalWin;
    }

    long freeSpinsWin() {
        return freeSpinsWin;
    }

    RoundResult build() {
        return new RoundResult(totalWin, steps, freeSpinsTriggered, freeSpinsPlayed, freeSpinsWin, maxWinReached);
    }
}
