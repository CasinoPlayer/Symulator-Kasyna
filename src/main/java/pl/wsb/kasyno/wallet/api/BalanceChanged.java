package pl.wsb.kasyno.wallet.api;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Zdarzenie: saldo gracza się zmieniło. Publikowane po każdej operacji w portfelu.
 *
 * <p>Po co: inne części aplikacji mogą reagować na zmianę salda (np. powiadomienia na żywo, migawka gospodarki
 * w {@code @Scheduled}, LAB 06), a portfel nie musi o nich wiedzieć.
 *
 * @param playerId identyfikator gracza
 * @param balance  saldo po zmianie
 * @param delta    zmiana (ujemna dla zakładu)
 * @param reason   rodzaj operacji: {@code WELCOME_BONUS}, {@code RESCUE_BONUS}, {@code BET}, {@code WIN}
 * @param at       chwila zmiany (UTC)
 */
public record BalanceChanged(Long playerId, BigDecimal balance, BigDecimal delta, String reason, Instant at) {
}
