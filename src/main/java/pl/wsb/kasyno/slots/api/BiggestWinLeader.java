package pl.wsb.kasyno.slots.api;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Rekord gracza do rankingu „największa pojedyncza wygrana”.
 *
 * @param playerId identyfikator gracza
 * @param nick     nazwa gracza
 * @param win      największa wygrana
 * @param gameCode gra, w której padła
 * @param at       kiedy padła (UTC)
 */
public record BiggestWinLeader(Long playerId, String nick, BigDecimal win, String gameCode, Instant at) {
}
