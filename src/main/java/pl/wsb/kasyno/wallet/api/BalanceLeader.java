package pl.wsb.kasyno.wallet.api;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Wiersz rankingu najwyższych sald (projekcja z zapytania JPQL {@code select new ...}).
 *
 * @param playerId  identyfikator gracza
 * @param nick      nazwa gracza
 * @param balance   saldo
 * @param updatedAt kiedy saldo ostatnio się zmieniło
 */
public record BalanceLeader(Long playerId, String nick, BigDecimal balance, Instant updatedAt) {
}
