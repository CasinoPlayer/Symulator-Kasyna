package pl.wsb.kasyno.slots.application.engine;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import pl.wsb.kasyno.shared.domain.Money;
import pl.wsb.kasyno.slots.entity.PlayerMachineStats;
import pl.wsb.kasyno.slots.entity.PlayerMachineStatsRepository;
import pl.wsb.kasyno.slots.entity.SpinRound;
import pl.wsb.kasyno.slots.entity.SpinRoundRepository;
import pl.wsb.kasyno.slots.entity.SpinStatus;
import pl.wsb.kasyno.slots.entity.WinTier;
import pl.wsb.kasyno.wallet.entity.TransactionType;
import pl.wsb.kasyno.wallet.entity.Wallet;
import pl.wsb.kasyno.wallet.entity.WalletRepository;
import pl.wsb.kasyno.wallet.entity.WalletTransaction;
import pl.wsb.kasyno.wallet.entity.WalletTransactionRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Dane startowe z {@code data.sql} (LAB 02, R2.03) muszą być prawdziwą historią gry, a nie zmyślonymi liczbami:
 * każda runda to dokładnie wynik silnika dla zapisanego ziarna i zakładu, saldo portfela to suma jego transakcji,
 * a statystyki gracza zgadzają się z rundami. Po zmianie matematyki gier (taśmy, wypłaty) ten test wskaże rundy,
 * których kwoty trzeba przeliczyć.
 */
@DataJpaTest(showSql = false)
@ActiveProfiles("test")
@Import(GameMathProvider.class)
@DisplayName("Dane startowe w data.sql: rundy, portfele i statystyki zgodne z silnikiem")
class StarterDataConsistencyTest {

    @Autowired
    private SpinRoundRepository rounds;
    @Autowired
    private WalletRepository wallets;
    @Autowired
    private WalletTransactionRepository transactions;
    @Autowired
    private PlayerMachineStatsRepository stats;
    @Autowired
    private GameMathProvider mathProvider;

    @Test
    @DisplayName("każda tabela LAB 02 ma co najmniej 3 wiersze danych startowych")
    void everyTableIsSeeded() {
        assertThat(rounds.count()).isGreaterThanOrEqualTo(3);
        assertThat(wallets.count()).isGreaterThanOrEqualTo(3);
        assertThat(transactions.count()).isGreaterThanOrEqualTo(3);
        assertThat(stats.count()).isGreaterThanOrEqualTo(3);
    }

    @Test
    @DisplayName("runda = wynik silnika dla jej ziarna i zakładu (wygrana, mnożnik, poziom wygranej)")
    void roundsAreRealEngineResults() {
        for (SpinRound round : rounds.findAll()) {
            var machine = round.getSlotMachine();
            String label = machine.getCode() + " / ziarno " + round.getSeed();
            assertThat(machine.allowsBet(round.getBet())).as("%s: dozwolony zakład", label).isTrue();
            assertThat(round.getStatus()).as(label).isEqualTo(SpinStatus.SETTLED);

            long engineWin = engineFor(machine.getCode())
                    .playRound(mathProvider.mathFor(machine), round.getBet().longValueExact(),
                            RandomSource.fromSeed(round.getSeed()))
                    .totalWin();
            assertThat(round.getTotalWin()).as("%s: wygrana", label).isEqualByComparingTo(BigDecimal.valueOf(engineWin));
            assertThat(round.getMultiplier()).as("%s: mnożnik", label)
                    .isEqualByComparingTo(round.getTotalWin().divide(round.getBet(), Money.SCALE, RoundingMode.HALF_UP));
            assertThat(round.getTier()).as("%s: poziom wygranej", label)
                    .isEqualTo(WinTier.of(round.getTotalWin(), round.getBet()));
        }
    }

    @Test
    @DisplayName("saldo portfela = suma transakcji; zakład i wygrana zgadzają się z rundą")
    void walletsMatchTheirTransactions() {
        Map<Long, SpinRound> roundsById = rounds.findAll().stream()
                .collect(Collectors.toMap(SpinRound::getId, Function.identity()));
        for (Wallet wallet : wallets.findAll()) {
            List<WalletTransaction> history = transactions.findAll().stream()
                    .filter(t -> t.getWallet().getId().equals(wallet.getId()))
                    .sorted(Comparator.comparing(WalletTransaction::getCreatedAt).thenComparing(WalletTransaction::getId))
                    .toList();
            assertThat(history).as("transakcje portfela %d", wallet.getId()).isNotEmpty();

            BigDecimal running = BigDecimal.ZERO;
            for (WalletTransaction t : history) {
                running = running.add(t.getAmount());
                assertThat(t.getBalanceAfter()).as("saldo po transakcji %d", t.getId()).isEqualByComparingTo(running);
                if (t.getType() == TransactionType.BET || t.getType() == TransactionType.WIN) {
                    SpinRound round = roundsById.get(t.getSpinRoundId());
                    assertThat(round).as("runda transakcji %d", t.getId()).isNotNull();
                    assertThat(round.getPlayer().getId()).isEqualTo(wallet.getPlayer().getId());
                    assertThat(t.getGameCode()).isEqualTo(round.getSlotMachine().getCode());
                    BigDecimal expected = t.getType() == TransactionType.BET ? round.getBet().negate() : round.getTotalWin();
                    assertThat(t.getAmount()).as("kwota transakcji %d", t.getId()).isEqualByComparingTo(expected);
                }
            }
            assertThat(wallet.getBalance()).as("saldo portfela %d", wallet.getId()).isEqualByComparingTo(running);
        }
    }

    @Test
    @DisplayName("statystyki gracza na automacie zgadzają się z jego rundami")
    void statsMatchRounds() {
        List<SpinRound> all = rounds.findAll();
        assertThat(stats.findAll()).hasSize((int) all.stream()
                .map(r -> r.getPlayer().getId() + "/" + r.getSlotMachine().getId()).distinct().count());
        for (PlayerMachineStats s : stats.findAll()) {
            List<SpinRound> own = all.stream()
                    .filter(r -> r.getPlayer().getId().equals(s.getPlayer().getId()))
                    .filter(r -> r.getSlotMachine().getId().equals(s.getSlotMachine().getId()))
                    .toList();
            String label = s.getPlayer().getDisplayName() + " / " + s.getSlotMachine().getCode();
            assertThat(s.getSpins()).as(label).isEqualTo(own.size());
            assertThat(s.getTotalWagered()).as(label).isEqualByComparingTo(sum(own, SpinRound::getBet));
            assertThat(s.getTotalWon()).as(label).isEqualByComparingTo(sum(own, SpinRound::getTotalWin));
            assertThat(s.getBiggestWin()).as(label).isEqualByComparingTo(
                    own.stream().map(SpinRound::getTotalWin).max(Comparator.naturalOrder()).orElse(BigDecimal.ZERO));
        }
    }

    private ConfiguredSlotEngine engineFor(String code) {
        return switch (code) {
            case SlotEnginesConfig.CEBULOWY_777 -> new LinesEngine(code, SlotEnginesConfig.CEBULOWY_777_RULES, mathProvider);
            case SlotEnginesConfig.ZLOTY_FARAON -> new LinesEngine(code, SlotEnginesConfig.ZLOTY_FARAON_RULES, mathProvider);
            case SlotEnginesConfig.KRYSZTALOWA_KASKADA -> new ClusterEngine(code, SlotEnginesConfig.KRYSZTALOWA_KASKADA_RULES, mathProvider);
            default -> throw new AssertionError("Nieznana gra: " + code);
        };
    }

    private static BigDecimal sum(List<SpinRound> rounds, Function<SpinRound, BigDecimal> field) {
        return rounds.stream().map(field).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
