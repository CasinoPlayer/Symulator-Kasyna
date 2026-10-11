package pl.wsb.kasyno.slots.application.engine;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import pl.wsb.kasyno.slots.application.SlotDebugScenarios;
import pl.wsb.kasyno.slots.domain.SlotMachineRepository;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

/** Scenariusze muszą nadal znaczyć to, co opisują przyciski, przy prawdziwych danych SQL i każdej stawce. */
@DataJpaTest(showSql = false)
@ActiveProfiles("test")
@Import(GameMathProvider.class)
@DisplayName("Scenariusze debugowania: rzeczywiste silniki, dane SQL i wszystkie stawki")
class SlotDebugScenariosTest {

    @Autowired
    private SlotMachineRepository machines;
    @Autowired
    private GameMathProvider mathProvider;

    @ParameterizedTest(name = "{0}: {1}")
    @CsvSource({
            "cebulowy-777,wild-win",
            "zloty-faraon,scatter",
            "zloty-faraon,bonus",
            "krysztalowa-kaskada,scatter",
            "krysztalowa-kaskada,bonus",
            "krysztalowa-kaskada,cascade"
    })
    void scenarioReplaysRealMechanicAtEveryBet(String code, String id) {
        var machine = machines.findByCodeAndActiveTrue(code).orElseThrow();
        var math = mathProvider.mathFor(machine);
        var scenarios = SlotDebugScenarios.forGame(code);
        assertThat(scenarios).extracting(SlotDebugScenarios.Scenario::id).doesNotHaveDuplicates();
        var scenario = scenarios.stream().filter(s -> s.id().equals(id)).findFirst().orElseThrow();
        assertThat(scenario.label()).isNotBlank();
        assertThat(scenario.seed()).matches("[0-9a-f]{16}");
        long seed = Long.parseUnsignedLong(scenario.seed(), 16);
        ConfiguredSlotEngine engine = switch (code) {
            case SlotEnginesConfig.CEBULOWY_777 -> new LinesEngine(code, SlotEnginesConfig.CEBULOWY_777_RULES, mathProvider);
            case SlotEnginesConfig.ZLOTY_FARAON -> new LinesEngine(code, SlotEnginesConfig.ZLOTY_FARAON_RULES, mathProvider);
            case SlotEnginesConfig.KRYSZTALOWA_KASKADA -> new ClusterEngine(code, SlotEnginesConfig.KRYSZTALOWA_KASKADA_RULES, mathProvider);
            default -> throw new AssertionError(code);
        };

        for (var betLevel : machine.getBetLevels().asList()) {
            long bet = betLevel.longValueExact();
            var round = engine.playRound(math, bet, RandomSource.fromSeed(seed));
            assertThat(round.maxWinReached()).as("%s / %s / bet=%d: no cap", code, id, bet).isFalse();
            var first = (RoundStep.Spin) round.steps().getFirst();
            assertThat(first.phase()).isEqualTo("base");
            long scatters = Arrays.stream(first.grid()).flatMap(Arrays::stream).filter("scatter"::equals).count();
            var freeSpins = round.steps().stream().filter(s -> s instanceof RoundStep.Spin spin && spin.phase().equals("free")).toList();

            switch (id) {
                case "scatter" -> {
                    assertThat(scatters).isEqualTo(1);
                    assertThat(round.totalWin()).isZero();
                    assertThat(round.freeSpinsTriggered()).isFalse();
                    assertThat(freeSpins).isEmpty();
                    assertThat(round.steps()).noneMatch(s -> s instanceof RoundStep.Cascade || s instanceof RoundStep.FreeSpinsStart);
                }
                case "bonus" -> {
                    int triggerCount = code.equals(SlotEnginesConfig.ZLOTY_FARAON) ? 3 : 4;
                    assertThat(scatters).isEqualTo(triggerCount);
                    assertThat(round.freeSpinsTriggered()).isTrue();
                    assertThat(round.freeSpinsPlayed()).isEqualTo(10);
                    assertThat(freeSpins).hasSize(10);
                    assertThat(round.freeSpinsWin()).isPositive();
                    assertThat(round.steps()).noneMatch(s -> s instanceof RoundStep.FreeSpinsRetrigger);
                    assertThat(round.steps().stream().filter(s -> s instanceof RoundStep.FreeSpinsStart))
                            .singleElement().satisfies(s -> {
                                var start = (RoundStep.FreeSpinsStart) s;
                                assertThat(start.count()).isEqualTo(10);
                                assertThat(start.trigger().length).isEqualTo(triggerCount);
                            });
                    assertThat(round.steps().getLast()).isEqualTo(new RoundStep.FreeSpinsEnd(round.freeSpinsWin()));
                }
                case "cascade" -> {
                    assertThat(scatters).isZero();
                    assertThat(round.freeSpinsTriggered()).isFalse();
                    assertThat(round.steps().stream().filter(s -> s instanceof RoundStep.Cascade)).hasSize(2);
                    assertThat(round.totalWin()).isPositive();
                }
                case "wild-win" -> {
                    assertThat(round.freeSpinsTriggered()).isFalse();
                    assertThat(round.steps().stream().filter(s -> s instanceof RoundStep.Win)
                            .map(s -> (RoundStep.Win) s).flatMap(w -> w.wins().stream()))
                            .anyMatch(w -> w instanceof WinItem.Line line && line.wildMultiplier() == 2 && line.amount() > 0
                                    && Arrays.stream(line.positions()).anyMatch(p -> first.grid()[p[0]][p[1]].equals("wild")));
                }
                default -> throw new AssertionError(id);
            }
        }
    }
}
