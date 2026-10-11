package pl.wsb.kasyno.shared.error;

/**
 * Wspólna klasa bazowa wyjątków biznesowych (domenowych) kasyna.
 *
 * <p>Po co: każdy wyjątek niesie stały {@link ErrorCode}, a jeden handler
 * ({@link GlobalExceptionHandler}) zamienia go na odpowiedź HTTP. Dzięki temu serwisy i encje nie znają HTTP:
 * rzucają np. {@code InsufficientFundsException}, a status 409 i kod {@code INSUFFICIENT_FUNDS} dobiera warstwa web.
 * Wyjątek jest niekontrolowany ({@code RuntimeException}), więc {@code @Transactional} automatycznie wycofa
 * transakcję, w której poleciał.
 */
public class CasinoException extends RuntimeException {

    private final ErrorCode code;
    private final Long retryAfterSeconds;

    public CasinoException(ErrorCode code, String message) {
        this(code, message, null);
    }

    public CasinoException(ErrorCode code, String message, Long retryAfterSeconds) {
        super(message);
        this.code = code;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public ErrorCode getCode() {
        return code;
    }

    /** Po ilu sekundach warto ponowić próbę (np. odliczanie bonusu ratunkowego) albo {@code null}. */
    public Long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
