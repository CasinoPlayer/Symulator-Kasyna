package pl.wsb.kasyno.shared.error;

import org.springframework.http.HttpStatus;

import java.net.URI;
import java.util.Locale;

/**
 * Stałe kody błędów API (pole {@code code} w odpowiedzi {@code application/problem+json}).
 *
 * <p>Po co: front-end nie powinien rozpoznawać błędów po treści komunikatu (ta może się zmienić), tylko po stałym
 * kodzie. Pierwsze dziesięć wartości to tabela z kontraktu {@code docs/projekt/09-kontrakt-api-i-assetow.md} § 1,
 * jeden do jednego. Kolejne dotyczą sytuacji spoza tabeli (gra bez silnika, nieznany adres, zła metoda HTTP).
 * Status HTTP jest przypisany do kodu tutaj, więc jest jedno źródło prawdy dla całej aplikacji.
 */
public enum ErrorCode {

    NICK_INVALID(HttpStatus.BAD_REQUEST, "Niepoprawna nazwa gracza"),
    NICK_FORBIDDEN(HttpStatus.BAD_REQUEST, "Niedozwolona nazwa gracza"),
    VALIDATION_FAILED(HttpStatus.BAD_REQUEST, "Niepoprawne dane żądania"),
    NOT_LOGGED_IN(HttpStatus.UNAUTHORIZED, "Brak zalogowanego gracza"),
    GAME_NOT_FOUND(HttpStatus.NOT_FOUND, "Nie ma takiej gry"),
    BET_INVALID(HttpStatus.BAD_REQUEST, "Niedozwolony zakład"),
    INSUFFICIENT_FUNDS(HttpStatus.CONFLICT, "Za mało cebulionów"),
    RESCUE_NOT_AVAILABLE(HttpStatus.CONFLICT, "Bonus ratunkowy niedostępny"),
    IDEMPOTENCY_CONFLICT(HttpStatus.CONFLICT, "Konflikt klucza idempotencji"),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Błąd serwera"),

    /** Gra jest w katalogu, ale jej silnik nie jest jeszcze zaimplementowany (etap silników gier). */
    GAME_NOT_READY(HttpStatus.SERVICE_UNAVAILABLE, "Gra jeszcze niedostępna"),
    /** Nieznany adres (np. literówka w ścieżce albo brak pliku statycznego). */
    NOT_FOUND(HttpStatus.NOT_FOUND, "Nie znaleziono"),
    /** Metoda HTTP nieobsługiwana pod tym adresem (np. GET zamiast POST). */
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "Niedozwolona metoda HTTP");

    private final HttpStatus status;
    private final String title;

    ErrorCode(HttpStatus status, String title) {
        this.status = status;
        this.title = title;
    }

    public HttpStatus status() {
        return status;
    }

    /** Krótki, stały opis po polsku (pole {@code title} w ProblemDetail). */
    public String title() {
        return title;
    }

    /**
     * Identyfikator typu problemu (pole {@code type}, RFC 9457), np. {@code /errors/insufficient-funds}.
     * To względny URI: nie musi prowadzić do strony, ma tylko jednoznacznie nazywać rodzaj błędu.
     */
    public URI type() {
        return URI.create("/errors/" + name().toLowerCase(Locale.ROOT).replace('_', '-'));
    }
}
