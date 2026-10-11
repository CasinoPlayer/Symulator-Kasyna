package pl.wsb.kasyno.account.api;

import java.math.BigDecimal;

/**
 * Stan pieniędzy gracza potrzebny do obiektu {@code player} w API (dostarcza go moduł {@code wallet}).
 *
 * @param balance                  saldo w cebulionach
 * @param minBet                   najmniejszy zakład spośród aktywnych gier (poniżej niego gracz jest „bankrutem”)
 * @param canRescue                czy można teraz odebrać bonus ratunkowy
 * @param rescueAvailableInSeconds za ile sekund bonus ratunkowy będzie dostępny (0, gdy już jest albo nie dotyczy)
 */
public record PlayerFunds(BigDecimal balance, BigDecimal minBet, boolean canRescue, long rescueAvailableInSeconds) {
}
