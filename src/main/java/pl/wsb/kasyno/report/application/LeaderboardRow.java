package pl.wsb.kasyno.report.application;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Wiersz rankingu w jednym kształcie dla obu rodzajów rankingu (wygrana albo saldo).
 *
 * @param nick     nazwa gracza
 * @param value    wartość rankingowa (wygrana albo saldo)
 * @param gameCode gra, w której padła wygrana ({@code null} dla rankingu sald)
 * @param at       kiedy padła wygrana / kiedy saldo ostatnio się zmieniło
 */
public record LeaderboardRow(String nick, BigDecimal value, String gameCode, Instant at) {
}
