package pl.wsb.kasyno.shared.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

import java.util.Optional;

/**
 * Obsługa sesji gracza w jednym miejscu: zapis po zalogowaniu, odczyt, wylogowanie.
 *
 * <p>Sesja jest serwerowa: przeglądarka trzyma tylko losowy identyfikator w ciasteczku ({@code HttpOnly},
 * {@code SameSite=Lax}, 7 dni; ustawienia w {@code application.properties}), a numer gracza leży w pamięci serwera
 * pod kluczem {@link #PLAYER_ID}. Skrypt na stronie nie może odczytać ciasteczka, więc nie da się go ukraść
 * przez wstrzyknięty JavaScript.
 */
public final class PlayerSession {

    /** Nazwa atrybutu sesji z identyfikatorem gracza ({@code user_account.id}). */
    public static final String PLAYER_ID = "kasyno.playerId";

    private PlayerSession() {
    }

    /**
     * Rozpoczyna sesję gracza. Starą sesję unieważniamy i tworzymy nową z nowym identyfikatorem:
     * to ochrona przed atakiem <i>session fixation</i> (ktoś podsuwa ofierze znany sobie identyfikator sesji).
     */
    public static void start(HttpServletRequest request, Long playerId) {
        HttpSession old = request.getSession(false);
        if (old != null) {
            old.invalidate();
        }
        request.getSession(true).setAttribute(PLAYER_ID, playerId);
    }

    /** Identyfikator zalogowanego gracza, jeśli jest sesja. */
    public static Optional<Long> playerId(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            return Optional.empty();
        }
        return session.getAttribute(PLAYER_ID) instanceof Long id ? Optional.of(id) : Optional.empty();
    }

    /** Wylogowanie: unieważnia sesję (jeśli była). */
    public static void end(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
    }
}
