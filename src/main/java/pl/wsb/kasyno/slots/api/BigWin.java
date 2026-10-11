package pl.wsb.kasyno.slots.api;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Duża wygrana do feedu w lobby („Kamil_77 wygrał 4 500 w Złotym Faraonie”).
 *
 * @param nick       nazwa gracza
 * @param gameCode   kod gry
 * @param gameName   nazwa gry
 * @param win        wygrana
 * @param multiplier wygrana jako wielokrotność zakładu
 * @param tier       poziom wygranej ({@code big}, {@code mega}, {@code epic}, {@code ultra})
 * @param at         kiedy padła (UTC)
 */
public record BigWin(String nick, String gameCode, String gameName, BigDecimal win, BigDecimal multiplier,
                     String tier, Instant at) {
}
