package pl.wsb.kasyno.account.domain;

import pl.wsb.kasyno.shared.error.CasinoException;
import pl.wsb.kasyno.shared.error.ErrorCode;

/**
 * Nazwa gracza odrzucona przez reguły: {@code NICK_INVALID} (długość lub znaki) albo {@code NICK_FORBIDDEN}
 * (nazwa zastrzeżona lub wulgarna). Oba przypadki to {@code 400}; osobne kody pozwalają frontowi pokazać
 * trafny komunikat przy polu „Nazwa gracza”.
 */
public class InvalidNickException extends CasinoException {

    private InvalidNickException(ErrorCode code, String message) {
        super(code, message);
    }

    public static InvalidNickException invalid(String message) {
        return new InvalidNickException(ErrorCode.NICK_INVALID, message);
    }

    public static InvalidNickException forbidden() {
        return new InvalidNickException(ErrorCode.NICK_FORBIDDEN, "Ta nazwa jest niedozwolona. Wybierz inną.");
    }
}
