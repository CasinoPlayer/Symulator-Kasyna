package pl.wsb.kasyno.slots.application;

import pl.wsb.kasyno.shared.error.CasinoException;
import pl.wsb.kasyno.shared.error.ErrorCode;

/**
 * Gra jest w katalogu, ale nie ma jeszcze silnika ({@code 503 GAME_NOT_READY}). Zakład nie jest pobierany.
 */
public class GameNotReadyException extends CasinoException {

    public GameNotReadyException(String gameCode) {
        super(ErrorCode.GAME_NOT_READY, "Gra „%s” jest w przygotowaniu. Wróć wkrótce!".formatted(gameCode));
    }
}
