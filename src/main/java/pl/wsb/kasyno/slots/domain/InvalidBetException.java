package pl.wsb.kasyno.slots.domain;

import pl.wsb.kasyno.shared.error.CasinoException;
import pl.wsb.kasyno.shared.error.ErrorCode;

import java.math.BigDecimal;

/**
 * Zakład spoza listy {@code betLevels} gry: {@code 400 BET_INVALID}. Serwer nie ufa przeglądarce: nawet jeśli
 * ktoś ręcznie wyśle {@code {"bet": 7}}, zakład zostanie odrzucony.
 */
public class InvalidBetException extends CasinoException {

    public InvalidBetException(BigDecimal bet, BetLevels allowed) {
        super(ErrorCode.BET_INVALID, "Zakład %s jest niedozwolony. Dozwolone: %s."
                .formatted(bet == null ? "(brak)" : bet.stripTrailingZeros().toPlainString(), allowed.toCsv()));
    }
}
