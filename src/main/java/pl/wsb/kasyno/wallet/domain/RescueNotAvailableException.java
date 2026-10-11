package pl.wsb.kasyno.wallet.domain;

import pl.wsb.kasyno.shared.error.CasinoException;
import pl.wsb.kasyno.shared.error.ErrorCode;

/**
 * Bonus ratunkowy niedostępny ({@code 409 RESCUE_NOT_AVAILABLE}): saldo wystarcza na najmniejszy zakład albo
 * trwa odliczanie od poprzedniego bonusu (wtedy {@code retryAfterSeconds} mówi, ile jeszcze czekać).
 */
public class RescueNotAvailableException extends CasinoException {

    private RescueNotAvailableException(String message, Long retryAfterSeconds) {
        super(ErrorCode.RESCUE_NOT_AVAILABLE, message, retryAfterSeconds);
    }

    public static RescueNotAvailableException balanceTooHigh() {
        return new RescueNotAvailableException(
                "Bonus ratunkowy przysługuje dopiero, gdy saldo spadnie poniżej najmniejszego zakładu.", null);
    }

    public static RescueNotAvailableException coolingDown(long secondsLeft) {
        return new RescueNotAvailableException(
                "Kolejny bonus ratunkowy będzie dostępny za %d s.".formatted(secondsLeft), secondsLeft);
    }
}
