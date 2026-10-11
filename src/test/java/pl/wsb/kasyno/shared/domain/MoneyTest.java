package pl.wsb.kasyno.shared.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Kwoty w komunikatach dla gracza: zwykłe liczby bez zbędnych zer, absurdalne w zapisie naukowym
 * (zabezpieczenie przed {@code OutOfMemoryError} przy liczbie typu {@code 1e999999999} z żądania).
 */
@DisplayName("Money: kwoty w komunikatach")
class MoneyTest {

    @Test
    @DisplayName("zwykłe kwoty: 100.00 → 100, 95.50 → 95.5, 0.00 → 0")
    void describesOrdinaryAmounts() {
        assertThat(Money.describe(new BigDecimal("100.00"))).isEqualTo("100");
        assertThat(Money.describe(new BigDecimal("95.50"))).isEqualTo("95.5");
        assertThat(Money.describe(new BigDecimal("0.00"))).isEqualTo("0");
        assertThat(Money.describe(null)).isEqualTo("(brak)");
    }

    @Test
    @Timeout(2)
    @DisplayName("absurdalna kwota (1e999999999, 1e-999999999) nie jest rozpisywana na miliard cyfr")
    void absurdAmountStaysShort() {
        assertThat(Money.describe(new BigDecimal("1e999999999"))).isEqualTo("1E+999999999");
        assertThat(Money.describe(new BigDecimal("1e-999999999"))).isEqualTo("1E-999999999");
    }
}
