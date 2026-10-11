package pl.wsb.kasyno.slots.domain;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import pl.wsb.kasyno.shared.domain.Money;
import pl.wsb.kasyno.support.TestData;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("SpinRound: cykl życia rundy (STARTED → RESOLVED → SETTLED / FAILED)")
class SpinRoundTest {

    private static final Instant NOW = Instant.parse("2026-10-11T12:00:00Z");

    private SpinRound round;

    @BeforeEach
    void setUp() {
        round = new SpinRound(TestData.player("Kamil"), TestData.cebulowy777(), Money.of(100), 42L, "klucz-1", NOW);
    }

    @Test
    @DisplayName("nowa runda: STARTED, bez wygranej")
    void startsAsStarted() {
        assertThat(round.getStatus()).isEqualTo(SpinStatus.STARTED);
        assertThat(round.getTotalWin()).isEqualByComparingTo("0");
        assertThat(round.getTier()).isEqualTo(WinTier.NONE);
        assertThat(round.getSeed()).isEqualTo(42L);
    }

    @Test
    @DisplayName("ścieżka szczęśliwa: resolve liczy mnożnik i poziom, settle kończy rundę")
    void happyPath() {
        round.resolve(Money.of(2_000), "{\"steps\":[]}");
        assertThat(round.getStatus()).isEqualTo(SpinStatus.RESOLVED);
        assertThat(round.getMultiplier()).isEqualByComparingTo("20");
        assertThat(round.getTier()).isEqualTo(WinTier.BIG);

        round.settle(NOW.plusSeconds(1));
        assertThat(round.getStatus()).isEqualTo(SpinStatus.SETTLED);
        assertThat(round.getSettledAt()).isEqualTo(NOW.plusSeconds(1));
    }

    @Test
    @DisplayName("nie można rozliczyć rundy bez wyniku (STARTED → SETTLED)")
    void cannotSettleWithoutResult() {
        assertThatThrownBy(() -> round.settle(NOW)).isInstanceOf(InvalidSpinTransitionException.class);
        assertThat(round.getStatus()).isEqualTo(SpinStatus.STARTED);
    }

    @Test
    @DisplayName("nie można rozliczyć rundy dwa razy (podwójna wypłata)")
    void cannotSettleTwice() {
        round.resolve(Money.of(50), "{}");
        round.settle(NOW);
        assertThatThrownBy(() -> round.settle(NOW)).isInstanceOf(InvalidSpinTransitionException.class);
    }

    @Test
    @DisplayName("nie można losować drugi raz (RESOLVED → RESOLVED)")
    void cannotResolveTwice() {
        round.resolve(Money.of(50), "{}");
        assertThatThrownBy(() -> round.resolve(Money.of(5_000), "{}")).isInstanceOf(InvalidSpinTransitionException.class);
        assertThat(round.getTotalWin()).isEqualByComparingTo("50");
    }

    @Test
    @DisplayName("FAILED z STARTED i z RESOLVED; z FAILED i SETTLED już nic")
    void failTransitions() {
        round.fail(NOW);
        assertThat(round.getStatus()).isEqualTo(SpinStatus.FAILED);
        assertThatThrownBy(() -> round.resolve(Money.of(10), "{}")).isInstanceOf(InvalidSpinTransitionException.class);

        SpinRound resolved = new SpinRound(TestData.player("Ola"), TestData.cebulowy777(), Money.of(10), 1L, null, NOW);
        resolved.resolve(Money.of(0), "{}");
        resolved.fail(NOW);
        assertThat(resolved.getStatus()).isEqualTo(SpinStatus.FAILED);

        SpinRound settled = new SpinRound(TestData.player("Kuba"), TestData.cebulowy777(), Money.of(10), 1L, null, NOW);
        settled.resolve(Money.of(0), "{}");
        settled.settle(NOW);
        assertThatThrownBy(() -> settled.fail(NOW)).isInstanceOf(InvalidSpinTransitionException.class);
    }

    @Test
    @DisplayName("wynik silnika: wygrana nie może być ujemna, JSON jest wymagany")
    void resolveValidatesOutcome() {
        assertThatThrownBy(() -> round.resolve(Money.of(-1), "{}")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> round.resolve(Money.of(1), " ")).isInstanceOf(IllegalArgumentException.class);
        assertThat(round.getStatus()).isEqualTo(SpinStatus.STARTED);
    }

    @Test
    @DisplayName("idempotencja: to samo żądanie = ta sama gra i ten sam zakład")
    void matchesRequest() {
        assertThat(round.matchesRequest("cebulowy-777", Money.of(100))).isTrue();
        assertThat(round.matchesRequest("cebulowy-777", new java.math.BigDecimal("100"))).isTrue();
        assertThat(round.matchesRequest("cebulowy-777", Money.of(200))).isFalse();
        assertThat(round.matchesRequest("zloty-faraon", Money.of(100))).isFalse();
    }

    @ParameterizedTest(name = "{0} → {1}: {2}")
    @CsvSource({
            "STARTED, RESOLVED, true", "STARTED, FAILED, true", "STARTED, SETTLED, false",
            "RESOLVED, SETTLED, true", "RESOLVED, FAILED, true", "RESOLVED, STARTED, false",
            "SETTLED, FAILED, false", "SETTLED, STARTED, false", "FAILED, SETTLED, false"})
    @DisplayName("tabela dozwolonych przejść")
    void transitionTable(SpinStatus from, SpinStatus to, boolean allowed) {
        assertThat(from.canTransitionTo(to)).isEqualTo(allowed);
    }
}
