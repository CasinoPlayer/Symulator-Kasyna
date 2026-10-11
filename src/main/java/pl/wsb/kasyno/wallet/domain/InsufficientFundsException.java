package pl.wsb.kasyno.wallet.domain;

import pl.wsb.kasyno.shared.domain.Money;
import pl.wsb.kasyno.shared.error.CasinoException;
import pl.wsb.kasyno.shared.error.ErrorCode;

import java.math.BigDecimal;

/**
 * Saldo mniejsze niż kwota zakładu ({@code 409 INSUFFICIENT_FUNDS}). Rzuca ją encja {@link Wallet}, zanim
 * cokolwiek zmieni, więc saldo nigdy nie spada poniżej zera.
 */
public class InsufficientFundsException extends CasinoException {

    public InsufficientFundsException(BigDecimal balance, BigDecimal requested) {
        super(ErrorCode.INSUFFICIENT_FUNDS, "Masz %s cebulionów, a zakład wynosi %s."
                .formatted(Money.describe(balance), Money.describe(requested)));
    }
}
