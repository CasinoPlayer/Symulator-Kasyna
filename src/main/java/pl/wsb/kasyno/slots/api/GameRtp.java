package pl.wsb.kasyno.slots.api;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Pytanie inwestora 2: rzeczywisty RTP automatu w porównaniu z docelowym.
 *
 * <p>RTP (<i>return to player</i>) = suma wygranych / suma zakładów × 100%. Docelowy RTP 95% oznacza, że
 * w długim okresie automat oddaje średnio 95 z każdych 100 postawionych cebulionów. Przy małej liczbie rund
 * rzeczywisty RTP mocno odbiega od docelowego (to normalne przy losowości), dlatego raport podaje też liczbę rund.
 *
 * @param gameCode     kod gry
 * @param gameName     nazwa gry
 * @param targetRtp    docelowy RTP w procentach
 * @param spins        liczba rozliczonych rund
 * @param totalWagered suma zakładów
 * @param totalWon     suma wygranych
 */
public record GameRtp(String gameCode, String gameName, BigDecimal targetRtp, Long spins, BigDecimal totalWagered,
                      BigDecimal totalWon) {

    public GameRtp {
        spins = spins == null ? 0L : spins;
        totalWagered = totalWagered == null ? BigDecimal.ZERO : totalWagered;
        totalWon = totalWon == null ? BigDecimal.ZERO : totalWon;
    }

    /** Rzeczywisty RTP w procentach (2 miejsca po przecinku) albo {@code null}, gdy nikt jeszcze nie grał. */
    public BigDecimal actualRtp() {
        if (totalWagered.signum() == 0) {
            return null;
        }
        return totalWon.multiply(BigDecimal.valueOf(100)).divide(totalWagered, 2, RoundingMode.HALF_UP);
    }
}
