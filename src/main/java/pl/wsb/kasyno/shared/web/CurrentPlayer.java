package pl.wsb.kasyno.shared.web;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Oznacza parametr metody kontrolera, do którego Spring ma wstawić identyfikator zalogowanego gracza
 * (typ {@code Long}).
 *
 * <p>Przykład: {@code public PlayerView me(@CurrentPlayer Long playerId)}.
 * Wartość bierze {@link CurrentPlayerArgumentResolver} z sesji HTTP. Gdy gracz nie jest zalogowany,
 * metoda kontrolera w ogóle się nie wykona, a klient dostanie {@code 401 NOT_LOGGED_IN}.
 * Po co: kontrolery nie powtarzają w każdej metodzie kodu „wyciągnij z sesji, sprawdź null, rzuć 401”.
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface CurrentPlayer {
}
