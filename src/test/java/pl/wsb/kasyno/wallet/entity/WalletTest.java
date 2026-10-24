package pl.wsb.kasyno.wallet.entity;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import pl.wsb.kasyno.shared.domain.Money;
import pl.wsb.kasyno.support.TestData;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Reguły portfela sprawdzane na samej encji: zwykły test jednostkowy, bez bazy i bez Springa.
 */
@DisplayName("Wallet: reguły salda")
class WalletTest {

    private static final Instant NOW = Instant.parse("2026-10-11T12:00:00Z");
    private static final BigDecimal MIN_BET = Money.of(10);
    private static final Duration COOLDOWN = Duration.ofMinutes(10);

    private Wallet wallet;

    @BeforeEach
    void setUp() {
        wallet = new Wallet(TestData.player("Kamil"), NOW);
        wallet.credit(TransactionType.WELCOME_BONUS, Money.of(100), null, null, NOW);
    }

    @Test
    @DisplayName("zakład zmniejsza saldo, a wpis ma ujemną kwotę i saldo po operacji")
    void debitRecordsNegativeAmountAndBalanceAfter() {
        WalletTransaction bet = wallet.debitBet(Money.of(30), "cebulowy-777", 5L, NOW);

        assertThat(wallet.getBalance()).isEqualByComparingTo("70");
        assertThat(bet.getType()).isEqualTo(TransactionType.BET);
        assertThat(bet.getAmount()).isEqualByComparingTo("-30");
        assertThat(bet.getBalanceAfter()).isEqualByComparingTo("70");
        assertThat(bet.getGameCode()).isEqualTo("cebulowy-777");
        assertThat(bet.getSpinRoundId()).isEqualTo(5L);
    }

    @Test
    @DisplayName("saldo nigdy nie spada poniżej zera: zakład większy niż saldo jest odrzucany przed zmianą")
    void neverNegative() {
        assertThatThrownBy(() -> wallet.debitBet(Money.of(101), "cebulowy-777", null, NOW))
                .isInstanceOf(InsufficientFundsException.class);
        assertThat(wallet.getBalance()).isEqualByComparingTo("100");
    }

    @Test
    @DisplayName("można postawić dokładnie całe saldo (saldo = 0)")
    void canBetWholeBalance() {
        wallet.debitBet(Money.of(100), "cebulowy-777", null, NOW);
        assertThat(wallet.getBalance()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("kwota operacji musi być dodatnia")
    void rejectsNonPositiveAmounts() {
        assertThatThrownBy(() -> wallet.debitBet(BigDecimal.ZERO, "x", null, NOW)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> wallet.credit(TransactionType.WIN, Money.of(-5), "x", null, NOW))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("credit przyjmuje tylko WIN i WELCOME_BONUS (bonus ratunkowy ma osobne reguły)")
    void creditRejectsOtherTypes() {
        assertThatThrownBy(() -> wallet.credit(TransactionType.RESCUE_BONUS, Money.of(10), null, null, NOW))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> wallet.credit(TransactionType.BET, Money.of(10), null, null, NOW))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("bonus ratunkowy niedostępny, gdy saldo wystarcza na najmniejszy zakład")
    void rescueRequiresBankruptcy() {
        assertThatThrownBy(() -> wallet.rescue(Money.of(10_000), MIN_BET, COOLDOWN, NOW))
                .isInstanceOf(RescueNotAvailableException.class)
                .extracting(e -> ((RescueNotAvailableException) e).getRetryAfterSeconds())
                .isNull();
    }

    @Test
    @DisplayName("bonus ratunkowy: dostępny dla bankruta, potem odliczanie 10 minut")
    void rescueWithCooldown() {
        wallet.debitBet(Money.of(95), "cebulowy-777", null, NOW); // saldo 5 < 10
        assertThat(wallet.canRescue(MIN_BET, COOLDOWN, NOW)).isTrue();

        WalletTransaction rescue = wallet.rescue(Money.of(10_000), MIN_BET, COOLDOWN, NOW);
        assertThat(rescue.getType()).isEqualTo(TransactionType.RESCUE_BONUS);
        assertThat(wallet.getBalance()).isEqualByComparingTo("10005");
        assertThat(wallet.getLastRescueAt()).isEqualTo(NOW);

        wallet.debitBet(Money.of(10_000), "cebulowy-777", null, NOW); // znowu bankrut
        Instant later = NOW.plus(Duration.ofMinutes(3));
        assertThat(wallet.canRescue(MIN_BET, COOLDOWN, later)).isFalse();
        assertThatThrownBy(() -> wallet.rescue(Money.of(10_000), MIN_BET, COOLDOWN, later))
                .isInstanceOf(RescueNotAvailableException.class)
                .extracting(e -> ((RescueNotAvailableException) e).getRetryAfterSeconds())
                .isEqualTo(420L);

        Instant afterCooldown = NOW.plus(COOLDOWN);
        assertThat(wallet.canRescue(MIN_BET, COOLDOWN, afterCooldown)).isTrue();
    }

    @Test
    @DisplayName("odliczanie zaokrąglamy w górę do pełnych sekund")
    void ceilSeconds() {
        assertThat(Wallet.ceilSeconds(Duration.ofMillis(300))).isEqualTo(1);
        assertThat(Wallet.ceilSeconds(Duration.ofSeconds(600))).isEqualTo(600);
        assertThat(Wallet.ceilSeconds(Duration.ZERO)).isZero();
    }
}
