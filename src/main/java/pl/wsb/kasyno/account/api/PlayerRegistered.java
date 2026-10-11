package pl.wsb.kasyno.account.api;

import java.math.BigDecimal;

/**
 * Zdarzenie: w kasynie pojawił się nowy gracz i należy mu się bonus powitalny.
 *
 * <p>Po co zdarzenie zamiast wywołania portfela wprost: moduł {@code account} jest „najniżej” (z konta korzystają
 * wszystkie moduły), więc nie może zależeć od modułu {@code wallet}, bo powstałby cykl zależności
 * ({@code wallet → account → wallet}). {@code LoginService} tylko ogłasza, że gracz powstał, a portfel sam reaguje
 * (zakłada portfel i księguje {@code WELCOME_BONUS}). Słuchacz działa synchronicznie, w tej samej transakcji,
 * więc konto bez portfela nigdy nie zostanie zapisane.
 *
 * @param playerId     identyfikator nowego konta ({@code user_account.id})
 * @param nick         nazwa gracza
 * @param welcomeBonus kwota bonusu powitalnego do zaksięgowania
 */
public record PlayerRegistered(Long playerId, String nick, BigDecimal welcomeBonus) {
}
