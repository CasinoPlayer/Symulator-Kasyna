package pl.wsb.kasyno.slots.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import pl.wsb.kasyno.slots.entity.GameNotFoundException;
import pl.wsb.kasyno.slots.entity.InvalidBetException;
import pl.wsb.kasyno.slots.entity.SlotMachine;
import pl.wsb.kasyno.slots.entity.SlotMachineRepository;
import pl.wsb.kasyno.slots.entity.SpinRound;
import pl.wsb.kasyno.slots.entity.SpinRoundRepository;
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
 *   <li>zakład musi być na liście {@code betLevels} gry ({@code 400 BET_INVALID});</li>
 *   <li>gra musi mieć silnik ({@code 503 GAME_NOT_READY});</li>
 *   <li>blokada portfela gracza ({@code SELECT ... FOR UPDATE}): od tej chwili spiny tego gracza wykonują się
 *       po kolei, a pozostałe czekają na koniec tej transakcji;</li>
 *   <li>idempotencja: jeśli gracz już wysłał żądanie z tym samym {@code Idempotency-Key}, zwracamy tamtą rundę
 *       zamiast losować nową (podwójne kliknięcie, ponowienie po zerwanym połączeniu). Ten sam klucz z inną grą
 *       lub innym zakładem to {@code 409 IDEMPOTENCY_CONFLICT}. Sprawdzamy to <b>dopiero pod blokadą</b>: gdy dwa
 *       identyczne żądania przyjdą jednocześnie, drugie poczeka na zatwierdzenie pierwszego i znajdzie jego rundę.
 *       Unikalny indeks (gracz, klucz) w bazie zostaje jako ostatni bezpiecznik;</li>
 *   <li>zapis rundy {@code STARTED} i pobranie zakładu z portfela ({@code 409 INSUFFICIENT_FUNDS}, a wtedy
 *       transakcja się wycofuje, więc nie zostaje ani runda, ani wpis w portfelu);</li>
 *   <li>silnik liczy wynik z wylosowanego ziarna → runda {@code RESOLVED}; jej {@code resultJson} to od razu
 *       cała odpowiedź HTTP z kontraktu § 2.4 ({@link SpinDocument}: kroki animacji, saldo przed i po, seed);</li>
 *   <li>wypłata wygranej do portfela → runda {@code SETTLED};</li>
 *   <li>zdarzenie {@link SpinCompleted}: statystyki gracza aktualizuje {@code StatsUpdater} synchronicznie, w tej samej
 *       transakcji, a feed i ranking w lobby odświeżają się dopiero po jej zatwierdzeniu
 *       ({@code @TransactionalEventListener(AFTER_COMMIT)} w module {@code report}).</li>
 * </ol>
 *
 * <p>Status {@code FAILED} jest częścią modelu, ale w tym przebiegu nie zostaje w bazie: każdy błąd po pobraniu
 * zakładu wycofuje całą transakcję (razem z zakładem), więc gracz nie traci cebulionów na nieudanym spinie.
 */
@Service
public class SpinService {

    private static final Logger log = LoggerFactory.getLogger(SpinService.class);

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
        if (!machine.allowsBet(command.bet())) {
            throw new InvalidBetException(command.bet(), machine.getBetLevels());
        }
        SlotEngine engine = engines.find(machine.getCode())
                .orElseThrow(() -> new GameNotReadyException(machine.getCode()));

        // od tego miejsca spiny tego gracza są szeregowane (opis kroku 4 w Javadoc klasy)
        BigDecimal balanceBefore = wallet.lockWallet(command.playerId());
        Optional<SpinResult> replay = replayIfRepeated(command, balanceBefore);
        if (replay.isPresent()) {
            return replay.get();
        }

        UserAccount player = accounts.findById(command.playerId()).orElseThrow(NotLoggedInException::new);

        long seed = seedFor(command);
        SpinRound round = rounds.save(new SpinRound(player, machine, command.bet(), seed,
                command.idempotencyKey(), clock.instant()));

        BigDecimal balance = wallet.debit(player.getId(), round.getBet(), machine.getCode(), round.getId());

        SpinOutcome outcome = engine.play(new SpinContext(machine, round.getBet(), seed));
        // resultJson = cała odpowiedź z kontraktu § 2.4 (z saldem po wypłacie), więc powtórka zwraca ją bez zmian
        BigDecimal expectedBalance = balance.add(outcome.totalWin());
        round.resolve(outcome.totalWin(), SpinDocument.compose(round.getId(), machine.getCode(), round.getBet(),
                outcome.totalWin(), balanceBefore, expectedBalance, seed, outcome.resultJson()));

        if (round.hasWin()) {
            balance = wallet.credit(player.getId(), round.getTotalWin(), machine.getCode(), round.getId());
        }
        if (balance.compareTo(expectedBalance) != 0) {
            // nie powinno się zdarzyć (portfel jest zablokowany); wycofujemy całą transakcję zamiast zapisać złe saldo
            throw new IllegalStateException("Saldo po rundzie " + round.getId() + " nie zgadza się z wyliczonym");
        }
        round.settle(clock.instant());

        events.publishEvent(new SpinCompleted(round.getId(), player.getId(), machine.getId(), machine.getCode(),
                round.getBet(), round.getTotalWin(), round.getMultiplier(), round.getTier().code(),
                round.getSettledAt()));
        return SpinResult.of(round, balance, false);
    }

    /**
     * Ziarno rundy: zwykle z {@link SeedGenerator} ({@code SecureRandom}, nie do przewidzenia). Wyjątek to profil
     * {@code demo}: skrypt nagrywający filmik podaje ziarno w nagłówku {@code X-Demo-Seed}, żeby pokazać wybraną rundę
     * (np. darmowe spiny). O tym, czy nagłówek w ogóle trafi do polecenia, decyduje kontroler na podstawie
     * {@code kasyno.demo.allow-seed}; tutaj tylko odnotowujemy w logu, że runda nie była losowa.
     */
    private long seedFor(SpinCommand command) {
        if (command.demoSeed() == null) {
            return seeds.nextSeed();
        }
        log.info("Profil demo: runda gracza {} w {} z ziarnem z nagłówka X-Demo-Seed ({})", command.playerId(),
                command.gameCode(), SpinDocument.seedHex(command.demoSeed()));
        return command.demoSeed();
    }

    /**
     * Powtórzone żądanie (ten sam gracz i klucz): ta sama runda albo konflikt, gdy ciało żądania jest inne.
     * W odpowiedzi podajemy aktualne saldo (odczytane pod blokadą), bo to ono ma się wyświetlić po animacji.
     */
    private Optional<SpinResult> replayIfRepeated(SpinCommand command, BigDecimal currentBalance) {
        if (command.idempotencyKey() == null) {
            return Optional.empty();
        }
        return rounds.findByPlayerAndIdempotencyKey(command.playerId(), command.idempotencyKey())
                .map(existing -> {
                    if (!existing.matchesRequest(command.gameCode(), command.bet())) {
                        throw new IdempotencyConflictException();
                    }
                    return SpinResult.of(existing, currentBalance, true);
                });
    }
}
