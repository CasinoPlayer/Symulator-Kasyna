package pl.wsb.kasyno.slots.application;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.wsb.kasyno.account.domain.UserAccount;
import pl.wsb.kasyno.account.domain.UserAccountRepository;
import pl.wsb.kasyno.shared.error.NotLoggedInException;
import pl.wsb.kasyno.slots.api.SpinCompleted;
import pl.wsb.kasyno.slots.application.engine.SeedGenerator;
import pl.wsb.kasyno.slots.application.engine.SlotEngine;
import pl.wsb.kasyno.slots.application.engine.SlotEngineRegistry;
import pl.wsb.kasyno.slots.application.engine.SpinContext;
import pl.wsb.kasyno.slots.application.engine.SpinOutcome;
import pl.wsb.kasyno.slots.domain.GameNotFoundException;
import pl.wsb.kasyno.slots.domain.InvalidBetException;
import pl.wsb.kasyno.slots.domain.SlotMachine;
import pl.wsb.kasyno.slots.domain.SlotMachineRepository;
import pl.wsb.kasyno.slots.domain.SpinRound;
import pl.wsb.kasyno.slots.domain.SpinRoundRepository;
import pl.wsb.kasyno.wallet.api.WalletFacade;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.Optional;

/**
 * Przypadek użycia „zakręć bębnami”: najważniejsza operacja kasyna.
 *
 * <p>Przebieg (wszystko w <b>jednej transakcji</b>, więc albo wykona się całość, albo nic):
 * <ol>
 *   <li>gra musi istnieć i być aktywna ({@code 404 GAME_NOT_FOUND});</li>
 *   <li>idempotencja: jeśli gracz już wysłał żądanie z tym samym {@code Idempotency-Key}, zwracamy tamtą rundę
 *       zamiast losować nową (podwójne kliknięcie, ponowienie po zerwanym połączeniu). Ten sam klucz z inną grą
 *       lub innym zakładem to {@code 409 IDEMPOTENCY_CONFLICT};</li>
 *   <li>zakład musi być na liście {@code betLevels} gry ({@code 400 BET_INVALID});</li>
 *   <li>gra musi mieć silnik ({@code 503 GAME_NOT_READY});</li>
 *   <li>zapis rundy {@code STARTED} i pobranie zakładu z portfela ({@code 409 INSUFFICIENT_FUNDS}, a wtedy
 *       transakcja się wycofuje, więc nie zostaje ani runda, ani wpis w portfelu);</li>
 *   <li>silnik liczy wynik z wylosowanego ziarna → runda {@code RESOLVED};</li>
 *   <li>wypłata wygranej do portfela → runda {@code SETTLED};</li>
 *   <li>zdarzenie {@link SpinCompleted} (statystyki gracza aktualizuje {@code StatsUpdater}, w tej samej transakcji).</li>
 * </ol>
 *
 * <p>Status {@code FAILED} jest częścią modelu, ale w tym przebiegu nie zostaje w bazie: każdy błąd po pobraniu
 * zakładu wycofuje całą transakcję (razem z zakładem), więc gracz nie traci cebulionów na nieudanym spinie.
 */
@Service
public class SpinService {

    private final SlotMachineRepository machines;
    private final SpinRoundRepository rounds;
    private final UserAccountRepository accounts;
    private final WalletFacade wallet;
    private final SlotEngineRegistry engines;
    private final SeedGenerator seeds;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public SpinService(SlotMachineRepository machines, SpinRoundRepository rounds, UserAccountRepository accounts,
                       WalletFacade wallet, SlotEngineRegistry engines, SeedGenerator seeds,
                       ApplicationEventPublisher events, Clock clock) {
        this.machines = machines;
        this.rounds = rounds;
        this.accounts = accounts;
        this.wallet = wallet;
        this.engines = engines;
        this.seeds = seeds;
        this.events = events;
        this.clock = clock;
    }

    @Transactional
    public SpinResult spin(SpinCommand command) {
        SlotMachine machine = machines.findByCodeAndActiveTrue(command.gameCode())
                .orElseThrow(() -> new GameNotFoundException(command.gameCode()));

        Optional<SpinResult> replay = replayIfRepeated(command);
        if (replay.isPresent()) {
            return replay.get();
        }

        if (!machine.allowsBet(command.bet())) {
            throw new InvalidBetException(command.bet(), machine.getBetLevels());
        }
        SlotEngine engine = engines.find(machine.getCode())
                .orElseThrow(() -> new GameNotReadyException(machine.getCode()));
        UserAccount player = accounts.findById(command.playerId()).orElseThrow(NotLoggedInException::new);

        long seed = seeds.nextSeed();
        SpinRound round = rounds.save(new SpinRound(player, machine, command.bet(), seed,
                command.idempotencyKey(), clock.instant()));

        BigDecimal balance = wallet.debit(player.getId(), round.getBet(), machine.getCode(), round.getId());

        SpinOutcome outcome = engine.play(new SpinContext(machine, round.getBet(), seed));
        round.resolve(outcome.totalWin(), outcome.resultJson());

        if (round.hasWin()) {
            balance = wallet.credit(player.getId(), round.getTotalWin(), machine.getCode(), round.getId());
        }
        round.settle(clock.instant());

        events.publishEvent(new SpinCompleted(round.getId(), player.getId(), machine.getId(), machine.getCode(),
                round.getBet(), round.getTotalWin(), round.getMultiplier(), round.getTier().code(),
                round.getSettledAt()));
        return SpinResult.of(round, balance, false);
    }

    /** Powtórzone żądanie (ten sam gracz i klucz): ta sama runda albo konflikt, gdy ciało żądania jest inne. */
    private Optional<SpinResult> replayIfRepeated(SpinCommand command) {
        if (command.idempotencyKey() == null) {
            return Optional.empty();
        }
        return rounds.findByPlayerAndIdempotencyKey(command.playerId(), command.idempotencyKey())
                .map(existing -> {
                    if (!existing.matchesRequest(command.gameCode(), command.bet())) {
                        throw new IdempotencyConflictException();
                    }
                    return SpinResult.of(existing, wallet.balance(command.playerId()), true);
                });
    }
}
