package pl.wsb.kasyno.slots.api;

import java.math.BigDecimal;

/**
 * Pytanie inwestora 3: wyniki gracza zsumowane po wszystkich automatach (projekcja JPQL z
 * {@code player_machine_stats} z {@code GROUP BY} gracza).
 *
 * @param playerId     identyfikator gracza
 * @param nick         nazwa gracza
 * @param spins        liczba rund
 * @param totalWagered suma zakładów
 * @param totalWon     suma wygranych
 * @param biggestWin   największa pojedyncza wygrana
 */
public record PlayerResult(Long playerId, String nick, Long spins, BigDecimal totalWagered, BigDecimal totalWon,
                           BigDecimal biggestWin) {

    /** Bilans: wygrane minus postawione. */
    public BigDecimal netResult() {
        return totalWon.subtract(totalWagered);
    }
}
