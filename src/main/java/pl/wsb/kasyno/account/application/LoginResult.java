package pl.wsb.kasyno.account.application;

import java.math.BigDecimal;

/**
 * Wynik logowania nazwą gracza.
 *
 * @param playerId     identyfikator gracza (trafia do sesji)
 * @param newPlayer    {@code true}, gdy konto powstało właśnie teraz
 * @param welcomeBonus przyznany bonus powitalny (0 dla powracającego gracza)
 */
public record LoginResult(Long playerId, boolean newPlayer, BigDecimal welcomeBonus) {
}
