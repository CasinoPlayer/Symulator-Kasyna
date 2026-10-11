package pl.wsb.kasyno.report.application;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.support.TransactionTemplate;
import pl.wsb.kasyno.report.application.LobbyBoardsCache.Board;
import pl.wsb.kasyno.shared.domain.Money;
import pl.wsb.kasyno.slots.api.SpinCompleted;
import pl.wsb.kasyno.wallet.api.BalanceChanged;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.EnumMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Słuchacz {@code @TransactionalEventListener(AFTER_COMMIT)} w prawdziwym kontekście Springa: reaguje dopiero po
 * zatwierdzeniu transakcji, nigdy po wycofaniu i nigdy w jej trakcie. Zdarzenia publikujemy sami w transakcji
 * ({@link TransactionTemplate}), tak jak robią to {@code SpinService} i {@code WalletService}.
 */
@SpringBootTest
@ActiveProfiles("test")
@DisplayName("LAB 06: feed i ranking odświeżane zdarzeniem PO zatwierdzeniu transakcji")
class LobbyBoardsListenerTest {

    @Autowired
    private ApplicationEventPublisher events;
    @Autowired
    private TransactionTemplate transactions;
    @Autowired
    private LobbyBoardsCache cache;

    private static SpinCompleted spin(long bet, long win) {
        BigDecimal multiplier = BigDecimal.valueOf(win).divide(BigDecimal.valueOf(bet));
        return new SpinCompleted(1L, 1L, 1L, "cebulowy-777", Money.of(bet), Money.of(win), multiplier, "big",
                Instant.parse("2026-10-11T12:00:00Z"));
    }

    private Map<Board, Long> generations() {
        Map<Board, Long> result = new EnumMap<>(Board.class);
        for (Board board : Board.values()) {
            result.put(board, cache.generation(board));
        }
        return result;
    }

    private long delta(Map<Board, Long> before, Board board) {
        return cache.generation(board) - before.get(board);
    }

    @Test
    @DisplayName("duża wygrana (≥ 15×): w trakcie transakcji nic, po commicie feed i ranking unieważnione")
    void bigWinAfterCommit() {
        Map<Board, Long> before = generations();

        transactions.executeWithoutResult(status -> {
            events.publishEvent(spin(100, 1500));
            // jeszcze przed commitem: słuchacz AFTER_COMMIT nie mógł się wykonać
            assertThat(delta(before, Board.BIG_WINS)).isZero();
        });

        assertThat(delta(before, Board.BIG_WINS)).isEqualTo(1);
        assertThat(delta(before, Board.BIGGEST_WIN)).isEqualTo(1);
        assertThat(delta(before, Board.BALANCE)).isZero();
    }

    @Test
    @DisplayName("wycofana transakcja: słuchacz się nie wykonuje (wycofany spin nie trafi do feedu ani do logu)")
    void rollbackIsIgnored() {
        Map<Board, Long> before = generations();

        transactions.executeWithoutResult(status -> {
            events.publishEvent(spin(100, 5000));
            events.publishEvent(new BalanceChanged(1L, Money.of(5000), Money.of(5000), "WIN", Instant.now()));
            status.setRollbackOnly();
        });

        assertThat(generations()).isEqualTo(before);
    }

    @Test
    @DisplayName("mała wygrana: tylko ranking „największa wygrana”; brak wygranej: nic")
    void smallAndNoWin() {
        Map<Board, Long> before = generations();

        transactions.executeWithoutResult(status -> events.publishEvent(spin(100, 300)));
        assertThat(delta(before, Board.BIGGEST_WIN)).isEqualTo(1);
        assertThat(delta(before, Board.BIG_WINS)).isZero();

        transactions.executeWithoutResult(status -> events.publishEvent(spin(100, 0)));
        assertThat(delta(before, Board.BIGGEST_WIN)).isEqualTo(1);
    }

    @Test
    @DisplayName("zmiana salda (BalanceChanged) po commicie: ranking sald unieważniony")
    void balanceChanged() {
        Map<Board, Long> before = generations();

        transactions.executeWithoutResult(status ->
                events.publishEvent(new BalanceChanged(1L, Money.of(9900), Money.of(-100), "BET", Instant.now())));

        assertThat(delta(before, Board.BALANCE)).isEqualTo(1);
        assertThat(delta(before, Board.BIG_WINS)).isZero();
    }

    @Test
    @DisplayName("zdarzenie poza transakcją: słuchacz AFTER_COMMIT je pomija (fallbackExecution = false)")
    void outsideTransaction() {
        Map<Board, Long> before = generations();

        events.publishEvent(new BalanceChanged(1L, Money.of(100), Money.of(100), "WIN", Instant.now()));

        assertThat(generations()).isEqualTo(before);
    }

    @Test
    @DisplayName("dla porównania: SpinCompleted poza transakcją odrzuca synchroniczny StatsUpdater (MANDATORY)")
    void statsUpdaterRequiresTransaction() {
        assertThatThrownBy(() -> events.publishEvent(spin(100, 2000)))
                .isInstanceOf(IllegalTransactionStateException.class);
    }
}
