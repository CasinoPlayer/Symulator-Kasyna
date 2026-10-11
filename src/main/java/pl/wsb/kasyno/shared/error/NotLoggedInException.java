package pl.wsb.kasyno.shared.error;

/**
 * Brak zalogowanego gracza: nie ma sesji albo sesja wskazuje na gracza, którego już nie ma w bazie
 * (np. po restarcie serwera, bo szablon kursu tworzy bazę od nowa: {@code ddl-auto=create-drop}).
 * Odpowiedź: {@code 401} z kodem {@code NOT_LOGGED_IN}, po której front pokazuje okno logowania.
 */
public class NotLoggedInException extends CasinoException {

    public NotLoggedInException() {
        super(ErrorCode.NOT_LOGGED_IN, "Zaloguj się, wpisując nazwę gracza.");
    }
}
