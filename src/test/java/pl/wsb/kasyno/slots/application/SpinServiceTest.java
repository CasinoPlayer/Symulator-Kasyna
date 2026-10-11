package pl.wsb.kasyno.slots.application;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.context.ApplicationEventPublisher;
import pl.wsb.kasyno.account.domain.UserAccount;
import pl.wsb.kasyno.account.domain.UserAccountRepository;
import pl.wsb.kasyno.shared.domain.Money;
import pl.wsb.kasyno.slots.api.SpinCompleted;
import pl.wsb.kasyno.slots.application.engine.FakeSlotEngine;
import pl.wsb.kasyno.slots.application.engine.SlotEngine;
import pl.wsb.kasyno.slots.application.engine.SlotEngineRegistry;
import pl.wsb.kasyno.slots.domain.GameNotFoundException;
import pl.wsb.kasyno.slots.domain.InvalidBetException;
import pl.wsb.kasyno.slots.domain.SlotMachine;
import pl.wsb.kasyno.slots.domain.SlotMachineRepository;
import pl.wsb.kasyno.slots.domain.SpinRound;
import pl.wsb.kasyno.slots.domain.SpinRoundRepository;
import pl.wsb.kasyno.slots.domain.SpinStatus;
import pl.wsb.kasyno.support.MutableClock;
import pl.wsb.kasyno.support.TestData;
import pl.wsb.kasyno.wallet.api.WalletFacade;
import pl.wsb.kasyno.wallet.domain.InsufficientFundsException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Spin z fałszywym silnikiem gry: sprawdzamy kolejność kroków (zakład → losowanie → wypłata → zdarzenie),
 * idempotencję i obsługę błędów. Portfel i repozytoria są atrapami (Mockito).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("SpinService: spin z fałszywym silnikiem")
class SpinServiceTest {

    private static final long PLAYER_ID = 7L;
    private static final long ROUND_ID = 100L;
    private static final long SEED = 42L;
    private static final String GAME = "cebulowy-777";
    private static final Instant NOW = Instant.parse("2026-10-11T12:00:00Z");

    @Mock
    private SlotMachineRepository machines;
    @Mock
    private SpinRoundRepository rounds;
    @Mock
    private UserAccountRepository accounts;
    @Mock
    private WalletFacade wallet;
    @Mock
    private ApplicationEventPublisher events;

    private final FakeSlotEngine engine = new FakeSlotEngine(GAME);
    private final UserAccount player = TestData.player(PLAYER_ID, "Kamil");
    private final SlotMachine machine = TestData.withId(TestData.cebulowy777(), 1L);
    private SpinService service;

    @BeforeEach
    void setUp() {
        service = newService(registryWith(engine));
        when(machines.findByCodeAndActiveTrue(GAME)).thenReturn(Optional.of(machine));
        when(accounts.findById(PLAYER_ID)).thenReturn(Optional.of(player));
        when(rounds.save(any(SpinRound.class))).thenAnswer(invocation -> TestData.withId(invocation.getArgument(0), ROUND_ID));
        when(wallet.lockWallet(PLAYER_ID)).thenReturn(Money.of(10_000));
        when(wallet.debit(anyLong(), any(), anyString(), anyLong())).thenReturn(Money.of(9_900));
        when(wallet.credit(anyLong(), any(), anyString(), anyLong())).thenAnswer(invocation ->
                Money.of(9_900).add(invocation.getArgument(1)));
    }

    private SpinService newService(SlotEngineRegistry registry) {
        return new SpinService(machines, rounds, accounts, wallet, registry, () -> SEED, events, new MutableClock(NOW));
    }

    private static SlotEngineRegistry registryWith(SlotEngine... engines) {
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        for (SlotEngine e : engines) {
            beans.addBean(e.gameCode(), e);
        }
        return new SlotEngineRegistry(beans.getBeanProvider(SlotEngine.class));
    }

    private static SpinCommand command(long bet, String key) {
        return new SpinCommand(PLAYER_ID, GAME, BigDecimal.valueOf(bet), key);
    }

    @Test
    @DisplayName("poprawny zakład z wygraną: debit → silnik (seed) → credit → SETTLED → SpinCompleted")
    void spinWithWin() {
        engine.willWin(2_000);

        SpinResult result = service.spin(command(100, "k-1"));

        verify(wallet).debit(PLAYER_ID, Money.of(100), GAME, ROUND_ID);
        assertThat(engine.calls()).singleElement().satisfies(context -> {
            assertThat(context.seed()).isEqualTo(SEED);
            assertThat(context.bet()).isEqualByComparingTo("100");
            assertThat(context.machine()).isSameAs(machine);
        });
        verify(wallet).credit(PLAYER_ID, Money.of(2_000), GAME, ROUND_ID);

        assertThat(result.roundId()).isEqualTo(ROUND_ID);
        assertThat(result.status()).isEqualTo(SpinStatus.SETTLED);
        assertThat(result.win()).isEqualByComparingTo("2000");
        assertThat(result.multiplier()).isEqualByComparingTo("20");
        assertThat(result.tier()).isEqualTo("big");
        assertThat(result.balance()).isEqualByComparingTo("11900");
        assertThat(result.replayed()).isFalse();
        assertThat(result.resultJson()).contains("\"seed\":42");

        ArgumentCaptor<SpinCompleted> event = ArgumentCaptor.forClass(SpinCompleted.class);
        verify(events).publishEvent(event.capture());
        assertThat(event.getValue().roundId()).isEqualTo(ROUND_ID);
        assertThat(event.getValue().playerId()).isEqualTo(PLAYER_ID);
        assertThat(event.getValue().slotMachineId()).isEqualTo(1L);
        assertThat(event.getValue().win()).isEqualByComparingTo("2000");
        assertThat(event.getValue().tier()).isEqualTo("big");
    }

    @Test
    @DisplayName("przegrana: bez wypłaty, poziom none, saldo po zakładzie")
    void spinWithoutWin() {
        SpinResult result = service.spin(command(100, null));

        verify(wallet, never()).credit(anyLong(), any(), anyString(), anyLong());
        assertThat(result.win()).isEqualByComparingTo("0");
        assertThat(result.tier()).isEqualTo("none");
        assertThat(result.balance()).isEqualByComparingTo("9900");
        verify(rounds, never()).findByPlayerAndIdempotencyKey(anyLong(), anyString());
    }

    @Test
    @DisplayName("zakład spoza betLevels → BET_INVALID, bez zakładu w portfelu i bez rundy")
    void invalidBet() {
        assertThatThrownBy(() -> service.spin(command(7, "k-1"))).isInstanceOf(InvalidBetException.class);

        verifyNoInteractions(wallet);
        verify(rounds, never()).save(any());
        assertThat(engine.calls()).isEmpty();
    }

    @Test
    @DisplayName("nieznana gra → GAME_NOT_FOUND")
    void unknownGame() {
        when(machines.findByCodeAndActiveTrue("nie-ma")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.spin(new SpinCommand(PLAYER_ID, "nie-ma", Money.of(10), null)))
                .isInstanceOf(GameNotFoundException.class);
        verifyNoInteractions(wallet);
    }

    @Test
    @DisplayName("gra bez silnika → GAME_NOT_READY (503), zakład nie jest pobierany")
    void gameWithoutEngine() {
        service = newService(registryWith());

        assertThatThrownBy(() -> service.spin(command(100, "k-1"))).isInstanceOf(GameNotReadyException.class);
        verifyNoInteractions(wallet);
        verify(rounds, never()).save(any());
    }

    @Test
    @DisplayName("brak środków → INSUFFICIENT_FUNDS: silnik nie losuje, brak wypłaty i zdarzenia")
    void insufficientFunds() {
        when(wallet.debit(anyLong(), any(), anyString(), anyLong()))
                .thenThrow(new InsufficientFundsException(Money.of(50), Money.of(100)));

        assertThatThrownBy(() -> service.spin(command(100, "k-1"))).isInstanceOf(InsufficientFundsException.class);

        assertThat(engine.calls()).isEmpty();
        verify(wallet, never()).credit(anyLong(), any(), anyString(), anyLong());
        verifyNoInteractions(events);
    }

    @Test
    @DisplayName("idempotencja: ten sam klucz i to samo ciało → ta sama runda, bez nowego zakładu i losowania")
    void replaysRoundForSameKey() {
        SpinRound existing = TestData.withId(new SpinRound(player, machine, Money.of(100), SEED, "k-1", NOW), 55L);
        existing.resolve(Money.of(300), "{\"saved\":true}");
        existing.settle(NOW);
        when(rounds.findByPlayerAndIdempotencyKey(PLAYER_ID, "k-1")).thenReturn(Optional.of(existing));
        when(wallet.lockWallet(PLAYER_ID)).thenReturn(Money.of(10_200));

        SpinResult result = service.spin(command(100, "k-1"));

        assertThat(result.roundId()).isEqualTo(55L);
        assertThat(result.replayed()).isTrue();
        assertThat(result.win()).isEqualByComparingTo("300");
        assertThat(result.resultJson()).isEqualTo("{\"saved\":true}");
        // saldo w powtórce: aktualne, odczytane pod blokadą portfela
        assertThat(result.balance()).isEqualByComparingTo("10200");
        verify(wallet, never()).debit(anyLong(), any(), anyString(), anyLong());
        verify(rounds, never()).save(any());
        assertThat(engine.calls()).isEmpty();
        verifyNoInteractions(events);
    }

    @Test
    @DisplayName("klucz idempotencji sprawdzany dopiero pod blokadą portfela (równoległe duplikaty czekają w kolejce)")
    void idempotencyIsCheckedUnderWalletLock() {
        service.spin(command(100, "k-1"));

        InOrder order = inOrder(wallet, rounds);
        order.verify(wallet).lockWallet(PLAYER_ID);
        order.verify(rounds).findByPlayerAndIdempotencyKey(PLAYER_ID, "k-1");
        order.verify(rounds).save(any(SpinRound.class));
        order.verify(wallet).debit(PLAYER_ID, Money.of(100), GAME, ROUND_ID);
    }

    @Test
    @DisplayName("idempotencja: ten sam klucz, inny zakład → IDEMPOTENCY_CONFLICT")
    void conflictForSameKeyDifferentBody() {
        SpinRound existing = TestData.withId(new SpinRound(player, machine, Money.of(100), SEED, "k-1", NOW), 55L);
        when(rounds.findByPlayerAndIdempotencyKey(PLAYER_ID, "k-1")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.spin(command(200, "k-1"))).isInstanceOf(IdempotencyConflictException.class);
        verify(wallet, never()).debit(anyLong(), any(), anyString(), anyLong());
    }

    @Test
    @DisplayName("runda zapisuje seed, zakład i klucz idempotencji")
    void persistsRoundData() {
        service.spin(command(50, "k-9"));

        ArgumentCaptor<SpinRound> saved = ArgumentCaptor.forClass(SpinRound.class);
        verify(rounds).save(saved.capture());
        assertThat(saved.getValue().getSeed()).isEqualTo(SEED);
        assertThat(saved.getValue().getBet()).isEqualByComparingTo("50");
        assertThat(saved.getValue().getIdempotencyKey()).isEqualTo("k-9");
        assertThat(saved.getValue().getCreatedAt()).isEqualTo(NOW);
    }
}
