package pl.wsb.kasyno.slots.domain;

import pl.wsb.kasyno.shared.domain.Money;
import pl.wsb.kasyno.shared.error.CasinoException;
import pl.wsb.kasyno.shared.error.ErrorCode;

import java.math.BigDecimal;

/**
 * Zakład spoza listy {@code betLevels} gry: {@code 400 BET_INVALID}. Serwer nie ufa przeglądarce: nawet jeśli
 * ktoś ręcznie wyśle {@code {"bet": 7}}, zakład zostanie odrzucony.
 *
 * <p>Kwotę w komunikacie formatuje {@link Money#describe}, bo zakład pochodzi od klienta i może być absurdalnie
 * duży (opis zagrożenia w Javadoc tej metody).
 */
public class InvalidBetException extends CasinoException {

    public InvalidBetException(BigDecimal bet, BetLevels allowed) {
        super(ErrorCode.BET_INVALID, "Zakład %s jest niedozwolony. Dozwolone: %s."
                .formatted(Money.describe(bet), allowed.toCsv()));
    }
}
