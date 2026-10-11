package pl.wsb.kasyno.wallet.application;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;
import pl.wsb.kasyno.account.api.PlayerFunds;
import pl.wsb.kasyno.account.api.PlayerRegistered;
import pl.wsb.kasyno.account.domain.UserAccount;
import pl.wsb.kasyno.account.domain.UserAccountRepository;
import pl.wsb.kasyno.shared.domain.Money;
import pl.wsb.kasyno.shared.error.NotLoggedInException;
import pl.wsb.kasyno.support.MutableClock;
import pl.wsb.kasyno.support.TestData;
import pl.wsb.kasyno.wallet.api.BalanceChanged;
import pl.wsb.kasyno.wallet.api.MinimumBetProvider;
import pl.wsb.kasyno.wallet.domain.InsufficientFundsException;
import pl.wsb.kasyno.wallet.domain.RescueNotAvailableException;
import pl.wsb.kasyno.wallet.domain.TransactionType;
import pl.wsb.kasyno.wallet.domain.Wallet;
import pl.wsb.kasyno.wallet.domain.WalletRepository;
import pl.wsb.kasyno.wallet.domain.WalletTransaction;
import pl.wsb.kasyno.wallet.domain.WalletTransactionRepository;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("WalletService: zakłady, wygrane, bonusy")
class WalletServiceTest {

    private static final long PLAYER_ID = 7L;
    private static final Instant START = Instant.parse("2026-10-11T12:00:00Z");

    @Mock
    private WalletRepository wallets;
    @Mock
    private WalletTransactionRepository transactions;
    @Mock
    private UserAccountRepository accounts;
    @Mock
    private MinimumBetProvider minimumBet;
    @Mock
    private ApplicationEventPublisher events;

    private final MutableClock clock = new MutableClock(START);
    private final UserAccount player = TestData.player(PLAYER_ID, "Kamil");
    private WalletService service;

    @BeforeEach
    void setUp() {
        service = new WalletService(wallets, transactions, accounts, minimumBet, TestData.properties(), events, clock);
        when(minimumBet.minimumBet()).thenReturn(Money.of(10));
        when(transactions.save(any(WalletTransaction.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(wallets.save(any(Wallet.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(accounts.getReferenceById(PLAYER_ID)).thenReturn(player);
    }

    /** Portfel z danym saldem, zwracany przez repozytorium (także w wersji z blokadą). */
    private Wallet walletWithBalance(long balance) {
        Wallet wallet = new Wallet(player, START);
        if (balance > 0) {
            wallet.credit(TransactionType.WELCOME_BONUS, Money.of(balance), null, null, START);
        }
        when(wallets.findByPlayerId(PLAYER_ID)).thenReturn(Optional.of(wallet));
        when(wallets.findByPlayerIdForUpdate(PLAYER_ID)).thenReturn(Optional.of(wallet));
        return wallet;
    }

    @Test
    @DisplayName("nowy gracz: portfel z bonusem powitalnym i wpisem WELCOME_BONUS")
    void opensWalletWithWelcomeBonus() {
        when(wallets.findByPlayerId(PLAYER_ID)).thenReturn(Optional.empty());

        service.onPlayerRegistered(new PlayerRegistered(PLAYER_ID, "Kamil", Money.of(10_000)));

        ArgumentCaptor<WalletTransaction> saved = ArgumentCaptor.forClass(WalletTransaction.class);
        verify(transactions).save(saved.capture());
        assertThat(saved.getValue().getType()).isEqualTo(TransactionType.WELCOME_BONUS);
        assertThat(saved.getValue().getAmount()).isEqualByComparingTo("10000");
        assertThat(saved.getValue().getBalanceAfter()).isEqualByComparingTo("10000");
        verify(events).publishEvent(any(BalanceChanged.class));
    }

    @Test
    @DisplayName("bonus powitalny tylko raz: gdy portfel już istnieje, nic nie księgujemy")
    void welcomeBonusOnlyOnce() {
        walletWithBalance(500);

        BigDecimal balance = service.openWallet(PLAYER_ID, Money.of(10_000));

        assertThat(balance).isEqualByComparingTo("500");
        verify(wallets, never()).save(any());
        verify(transactions, never()).save(any());
    }

    @Test
    @DisplayName("zakład: blokada portfela, saldo w dół, wpis BET z saldem po operacji, zdarzenie BalanceChanged")
    void debitBooksBetWithLock() {
        walletWithBalance(1_000);

        BigDecimal balance = service.debit(PLAYER_ID, Money.of(100), "cebulowy-777", 42L);

        assertThat(balance).isEqualByComparingTo("900");
        verify(wallets).findByPlayerIdForUpdate(PLAYER_ID);
        ArgumentCaptor<WalletTransaction> saved = ArgumentCaptor.forClass(WalletTransaction.class);
        verify(transactions).save(saved.capture());
        assertThat(saved.getValue().getType()).isEqualTo(TransactionType.BET);
        assertThat(saved.getValue().getAmount()).isEqualByComparingTo("-100");
        assertThat(saved.getValue().getBalanceAfter()).isEqualByComparingTo("900");
        assertThat(saved.getValue().getSpinRoundId()).isEqualTo(42L);

        ArgumentCaptor<BalanceChanged> event = ArgumentCaptor.forClass(BalanceChanged.class);
        verify(events).publishEvent(event.capture());
        assertThat(event.getValue().balance()).isEqualByComparingTo("900");
        assertThat(event.getValue().delta()).isEqualByComparingTo("-100");
        assertThat(event.getValue().reason()).isEqualTo("BET");
    }

    @Test
    @DisplayName("saldo nigdy ujemne: zakład większy niż saldo → INSUFFICIENT_FUNDS i brak wpisu")
    void debitNeverGoesNegative() {
        Wallet wallet = walletWithBalance(50);

        assertThatThrownBy(() -> service.debit(PLAYER_ID, Money.of(100), "cebulowy-777", 1L))
                .isInstanceOf(InsufficientFundsException.class);

        assertThat(wallet.getBalance()).isEqualByComparingTo("50");
        verify(transactions, never()).save(any());
        verify(events, never()).publishEvent(any());
    }

    @Test
    @DisplayName("księgowanie: każda operacja ma balanceAfter, a suma kwot = saldo")
    void ledgerIsConsistent() {
        Wallet wallet = walletWithBalance(1_000);

        service.debit(PLAYER_ID, Money.of(100), "cebulowy-777", 1L);
        service.credit(PLAYER_ID, Money.of(250), "cebulowy-777", 1L);
        service.debit(PLAYER_ID, Money.of(500), "cebulowy-777", 2L);

        ArgumentCaptor<WalletTransaction> saved = ArgumentCaptor.forClass(WalletTransaction.class);
        verify(transactions, times(3)).save(saved.capture());
        List<WalletTransaction> ledger = saved.getAllValues();
        assertThat(ledger).extracting(WalletTransaction::getBalanceAfter)
                .usingComparatorForType(BigDecimal::compareTo, BigDecimal.class)
                .containsExactly(Money.of(900), Money.of(1_150), Money.of(650));
        BigDecimal sum = ledger.stream().map(WalletTransaction::getAmount).reduce(Money.of(1_000), BigDecimal::add);
        assertThat(sum).isEqualByComparingTo(wallet.getBalance());
    }

    @Test
    @DisplayName("rescue: 409 bez odliczania, gdy saldo ≥ minimalny zakład")
    void rescueNotAvailableWhenNotBankrupt() {
        walletWithBalance(10);

        assertThatThrownBy(() -> service.rescue(PLAYER_ID))
                .isInstanceOf(RescueNotAvailableException.class)
                .extracting(e -> ((RescueNotAvailableException) e).getRetryAfterSeconds())
                .isNull();
    }

    @Test
    @DisplayName("rescue: bankrut dostaje 10 000, kolejny dopiero po 10 minutach (czas z Clock)")
    void rescueCooldownUsesClock() {
        Wallet wallet = walletWithBalance(5);

        assertThat(service.rescue(PLAYER_ID)).isEqualByComparingTo("10000");
        assertThat(wallet.getBalance()).isEqualByComparingTo("10005");

        // gracz znowu traci wszystko
        service.debit(PLAYER_ID, Money.of(10_000), "cebulowy-777", 1L);

        clock.advance(Duration.ofMinutes(9).plusSeconds(59).plusMillis(500));
        assertThatThrownBy(() -> service.rescue(PLAYER_ID))
                .isInstanceOf(RescueNotAvailableException.class)
                .extracting(e -> ((RescueNotAvailableException) e).getRetryAfterSeconds())
                .isEqualTo(1L);
        PlayerFunds funds = service.fundsOf(PLAYER_ID);
        assertThat(funds.canRescue()).isFalse();
        assertThat(funds.rescueAvailableInSeconds()).isEqualTo(1L);

        clock.advance(Duration.ofMillis(500));
        assertThat(service.fundsOf(PLAYER_ID).canRescue()).isTrue();
        assertThat(service.rescue(PLAYER_ID)).isEqualByComparingTo("10000");
    }

    @Test
    @DisplayName("fundsOf: saldo, minimalny zakład i dostępność bonusu ratunkowego")
    void fundsForPlayerView() {
        walletWithBalance(10_000);

        PlayerFunds funds = service.fundsOf(PLAYER_ID);

        assertThat(funds.balance()).isEqualByComparingTo("10000");
        assertThat(funds.minBet()).isEqualByComparingTo("10");
        assertThat(funds.canRescue()).isFalse();
        assertThat(funds.rescueAvailableInSeconds()).isZero();
    }

    @Test
    @DisplayName("brak portfela (nieaktualna sesja) → NOT_LOGGED_IN")
    void missingWallet() {
        when(wallets.findByPlayerId(PLAYER_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.balance(PLAYER_ID)).isInstanceOf(NotLoggedInException.class);
    }
}
