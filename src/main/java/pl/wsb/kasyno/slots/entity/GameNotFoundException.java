package pl.wsb.kasyno.slots.entity;

import pl.wsb.kasyno.shared.error.CasinoException;
import pl.wsb.kasyno.shared.error.ErrorCode;

/**
 * Nieznany (albo wyłączony) kod gry: {@code 404 GAME_NOT_FOUND}.
 */
public class GameNotFoundException extends CasinoException {

    public GameNotFoundException(String code) {
        super(ErrorCode.GAME_NOT_FOUND, "Nie ma gry o kodzie „%s”.".formatted(code));
    }
}
