package pl.wsb.kasyno.slots.application.engine;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import pl.wsb.kasyno.slots.application.engine.EngineFixtures.ScriptedRandom;
import pl.wsb.kasyno.slots.domain.SlotMachine;

import java.util.List;
import java.util.stream.LongStream;

import static org.assertj.core.api.Assertions.assertThat;
import static pl.wsb.kasyno.slots.application.engine.EngineFixtures.grid;
import static pl.wsb.kasyno.slots.application.engine.EngineFixtures.linesMachine;
import static pl.wsb.kasyno.slots.application.engine.EngineFixtures.symbols;

/**
 * Konkretne układy w grach liniowych na małych, ręcznie zbudowanych grach (reguły z produkcyjnego
 * {@link SlotEnginesConfig}): zastępowanie przez WILD, liczenie od lewej, najwyższa wygrana na linii, scatter,
 * NEON JACKPOT, rozszerzanie WILD, darmowe spiny, limit wygranej, antycypacja i format JSON kroków.
 */
@DisplayName("LinesEngine: układy na liniach, funkcje S1 i S2")
class LinesEngineTest {

    private static final String S1_LINES = "1,1,1|0,0,0|2,2,2|0,1,2|2,1,0";

    /** Gra 3×3 jak Cebulowy 777: x=5, y=10, z=20, WILD=50 (mnożniki stawki na linię za 3 symbole). */
    private static GameMath s1Math(String[][] windows) {
        SlotMachine machine = linesMachine(3, 3, S1_LINES, windows);
        return GameMath.of(machine, symbols(machine,
                "x NORMAL 1 3:5", "y NORMAL 1 3:10", "z NORMAL 1 3:20", "w WILD 1 3:50"));
    }

    private static GameMath s1Math() {
        return s1Math(new String[][]{{"x,y,z", "x,y,z", "x,y,z"}});
    }

    private static final LinesEngine S1 = new LinesEngine("test", SlotEnginesConfig.CEBULOWY_777_RULES, null);

    @Nested
    @DisplayName("Cebulowy 777 (5 linii, neonowy mnożnik, NEON JACKPOT)")
    class Cebulowy {

        @Test
        @DisplayName("WILD zastępuje symbol na linii, a wygrana z WILD jest ×2 (neonowy mnożnik)")
        void wildSubstitutesAndDoubles() {
            GameMath math = s1Math();
            // środkowa linia: x, WILD, x; pozostałe linie bez wygranej
            List<WinItem> wins = S1.evaluate(math, grid(math, "y,x,z", "z,w,y", "x,x,z"), 50, false);

            assertThat(wins).singleElement().isInstanceOfSatisfying(WinItem.Line.class, win -> {
                assertThat(win.line()).isEqualTo(1);
                assertThat(win.symbol()).isEqualTo("x");
                assertThat(win.count()).isEqualTo(3);
                assertThat(win.positions()).isDeepEqualTo(new int[][]{{0, 1}, {1, 1}, {2, 1}});
                // 5 × (50 / 5 linii) × 2
                assertThat(win.amount()).isEqualTo(100);
                assertThat(win.wildMultiplier()).isEqualTo(2);
                assertThat(win.freeSpinMultiplier()).isEqualTo(1);
            });
        }

        @Test
        @DisplayName("linia z samych WILD płaci jak WILD, bez mnożnika ×2")
        void allWildLinePaysWild() {
            GameMath math = s1Math();
            List<WinItem> wins = S1.evaluate(math, grid(math, "y,w,z", "z,w,x", "x,w,z"), 50, false);

            assertThat(wins).singleElement().isInstanceOfSatisfying(WinItem.Line.class, win -> {
                assertThat(win.symbol()).isEqualTo("w");
                assertThat(win.amount()).isEqualTo(500);
                assertThat(win.wildMultiplier()).isEqualTo(1);
            });
        }

        @Test
        @DisplayName("WILD WILD z: wybierana najwyższa wygrana (trzy z ×2 = 40, a nie dwa WILD)")
        void picksHighestCombination() {
            GameMath math = s1Math();
            List<WinItem> wins = S1.evaluate(math, grid(math, "y,w,x", "x,w,y", "z,z,z"), 50, false);

            assertThat(wins).singleElement().isInstanceOfSatisfying(WinItem.Line.class, win -> {
                assertThat(win.symbol()).isEqualTo("z");
                assertThat(win.count()).isEqualTo(3);
                assertThat(win.amount()).isEqualTo(20 * 10 * 2);
            });
        }

        @Test
        @DisplayName("symbole muszą stać kolejno od lewego bębna: x z x nie płaci")
        void countsFromLeft() {
            GameMath math = s1Math();
            assertThat(S1.evaluate(math, grid(math, "y,x,z", "z,z,y", "x,x,x"), 50, false)).isEmpty();
        }

        @Test
        @DisplayName("NEON JACKPOT: cała plansza jednego symbolu (z WILD) → krok feature, wygrana linii ×10")
        void neonJackpot() {
            GameMath math = s1Math(new String[][]{{"x,x,x", "x,w,x", "x,x,x"}});

            RoundResult round = S1.playRound(math, 50, ScriptedRandom.constant(0));

            // linie: środkowa i obie skośne z WILD (×2) po 100, górna i dolna po 50 → 400; jackpot dodaje 9 × 400
            assertThat(round.steps()).hasSize(3);
            assertThat(round.steps().get(1)).isInstanceOfSatisfying(RoundStep.Win.class, win -> {
                assertThat(win.wins()).hasSize(5);
                assertThat(win.win()).isEqualTo(400);
            });
            assertThat(round.steps().get(2)).isEqualTo(new RoundStep.Feature("neonJackpot", 10, 3_600L, 4_000L));
            assertThat(round.totalWin()).isEqualTo(4_000);
        }

        @Test
        @DisplayName("antycypacja S1: WILD na dwóch pierwszych bębnach jednej linii → zwalnia trzeci bęben")
        void anticipationOnTwoWilds() {
            GameMath math = s1Math(new String[][]{{"y,w,z", "z,w,y", "x,y,z"}});

            RoundResult round = S1.playRound(math, 50, ScriptedRandom.constant(0));

            assertThat(((RoundStep.Spin) round.steps().getFirst()).anticipation()).containsExactly(2);
        }

        @Test
        @DisplayName("limit maksymalnej wygranej: kwota ucięta do limitu, krok maxWin, koniec rundy (bez jackpota)")
        void maxWinCapsRound() {
            LinesEngine capped = new LinesEngine("test", new LinesRules(2, 10, null, false, 1, 1,
                    LinesRules.Anticipation.NONE), null);
            GameMath math = s1Math(new String[][]{{"x,x,x", "x,w,x", "x,x,x"}});

            RoundResult round = capped.playRound(math, 50, ScriptedRandom.constant(0));

            assertThat(round.totalWin()).isEqualTo(50);
            assertThat(round.maxWinReached()).isTrue();
            assertThat(round.steps()).hasSize(3);
            assertThat(((RoundStep.Win) round.steps().get(1)).win()).isEqualTo(50);
            assertThat(round.steps().get(2)).isEqualTo(new RoundStep.Feature("maxWin", 1, null, null));
        }

        @Test
        @DisplayName("JSON kroków dokładnie w formacie kontraktu § 2.4")
        void jsonFormat() {
            GameMath math = s1Math(new String[][]{{"y,x,z", "z,w,y", "x,x,z"}});

            String json = RoundJson.stepsDocument(S1.playRound(math, 50, ScriptedRandom.constant(0)).steps());

            assertThat(json).isEqualTo("{\"steps\":["
                    + "{\"type\":\"spin\",\"phase\":\"base\",\"grid\":[[\"y\",\"x\",\"z\"],[\"z\",\"w\",\"y\"],"
                    + "[\"x\",\"x\",\"z\"]],\"anticipation\":[]},"
                    + "{\"type\":\"win\",\"wins\":[{\"kind\":\"line\",\"line\":1,\"symbol\":\"x\",\"count\":3,"
                    + "\"positions\":[[0,1],[1,1],[2,1]],\"amount\":100,\"wildMultiplier\":2,"
                    + "\"freeSpinMultiplier\":1}],\"win\":100,\"totalWin\":100}]}");
        }
    }

    @Nested
    @DisplayName("Złoty Faraon (scatter, darmowe spiny, rozszerzający się WILD)")
    class ZlotyFaraon {

        private static final String LINES = "1,1,1,1,1|0,0,0,0,0|2,2,2,2,2";
        private static final LinesEngine S2 = new LinesEngine("test", SlotEnginesConfig.ZLOTY_FARAON_RULES, null);

        /** Gra 5×3 z 3 liniami: a/b/c/d/e płacą 3:5,4:10,5:20; WILD bez wypłaty; scatter 3:2,4:10,5:50. */
        private static GameMath math(String[][] windows) {
            SlotMachine machine = linesMachine(5, 3, LINES, windows);
            return GameMath.of(machine, symbols(machine,
                    "a NORMAL 1 3:5,4:10,5:20", "b NORMAL 1 3:5,4:10,5:20", "c NORMAL 1 3:5,4:10,5:20",
                    "d NORMAL 1 3:5,4:10,5:20", "e NORMAL 1 3:5,4:10,5:20", "w WILD 1",
                    "s SCATTER 1 3:2,4:10,5:50"));
        }

        /** Okno bez wygranych, bez WILD i bez scatterów. */
        private static final String[] DEAD = {"a,b,c", "b,c,d", "c,d,e", "d,e,a", "e,a,b"};
        /** Okno z 3 scatterami (bębny 1, 3, 5) i bez wygranych liniowych. */
        private static final String[] THREE_SCATTERS = {"s,b,c", "b,c,d", "c,s,e", "d,e,a", "e,a,s"};

        @Test
        @DisplayName("scatter płaci za liczbę w dowolnym miejscu × zakład całkowity")
        void scatterPaysAnywhere() {
            GameMath math = math(new String[][]{DEAD});
            List<WinItem> wins = S2.evaluate(math, grid(math, THREE_SCATTERS), 30, false);

            assertThat(wins).singleElement().isInstanceOfSatisfying(WinItem.Scatter.class, win -> {
                assertThat(win.count()).isEqualTo(3);
                assertThat(win.positions()).isDeepEqualTo(new int[][]{{0, 0}, {2, 1}, {4, 2}});
                assertThat(win.amount()).isEqualTo(60);
            });
        }

        @Test
        @DisplayName("WILD nie zastępuje scattera, a scatter przerywa linię")
        void wildDoesNotReplaceScatter() {
            GameMath math = math(new String[][]{DEAD});
            // środkowa linia: a, WILD, scatter, a, a → tylko 2 symbole od lewej, brak wygranej
            assertThat(S2.evaluate(math, grid(math, "b,a,c", "c,w,d", "d,s,e", "e,a,b", "b,a,c"), 30, false))
                    .isEmpty();
        }

        @Test
        @DisplayName("linia liczona od lewej do pierwszej przerwy: a a a b a = 3 symbole")
        void lineStopsAtFirstGap() {
            GameMath math = math(new String[][]{DEAD});
            List<WinItem> wins = S2.evaluate(math, grid(math, "b,a,c", "c,a,d", "d,a,e", "e,b,b", "b,a,c"), 30, false);

            assertThat(wins).singleElement().isInstanceOfSatisfying(WinItem.Line.class, win -> {
                assertThat(win.count()).isEqualTo(3);
                assertThat(win.amount()).isEqualTo(50);
            });
        }

        @Test
        @DisplayName("3 scattery → 10 darmowych spinów; WILD rozszerza się na bęben (expandWild), wygrane ×2")
        void freeSpinsWithExpandingWild() {
            // okno 0: wyzwalacz; okno 1: WILD na bębnie 2 + a na bębnach 1 i 3 w środku; okno 2: puste
            GameMath math = math(new String[][]{THREE_SCATTERS,
                    {"b,a,c", "w,c,d", "c,a,e", "d,e,b", "e,b,c"}, DEAD});
            ScriptedRandom random = ScriptedRandom.constant(6).then(0, 0, 0, 0, 0, 3, 3, 3, 3, 3);

            RoundResult round = S2.playRound(math, 30, random);

            List<RoundStep> steps = round.steps();
            assertThat(steps.get(1)).isInstanceOf(RoundStep.Win.class);
            assertThat(steps.get(2)).isInstanceOfSatisfying(RoundStep.FreeSpinsStart.class, start -> {
                assertThat(start.count()).isEqualTo(10);
                assertThat(start.trigger()).isDeepEqualTo(new int[][]{{0, 0}, {2, 1}, {4, 2}});
            });
            assertThat(steps.get(3)).isInstanceOfSatisfying(RoundStep.Spin.class, spin -> {
                assertThat(spin.phase()).isEqualTo("free");
                assertThat(spin.freeSpinIndex()).isEqualTo(1);
                assertThat(spin.freeSpinsLeft()).isEqualTo(9);
            });
            assertThat(steps.get(4)).isInstanceOfSatisfying(RoundStep.ExpandWild.class, expand -> {
                assertThat(expand.reels()).containsExactly(1);
                assertThat(expand.grid()[1]).containsExactly("w", "w", "w");
            });
            assertThat(steps.get(5)).isInstanceOfSatisfying(RoundStep.Win.class, win ->
                    assertThat(win.wins()).singleElement().isInstanceOfSatisfying(WinItem.Line.class, line -> {
                        // środkowa linia a, WILD, a: 5 × (30 / 3) × 2 (darmowe spiny)
                        assertThat(line.amount()).isEqualTo(100);
                        assertThat(line.freeSpinMultiplier()).isEqualTo(2);
                        assertThat(line.wildMultiplier()).isEqualTo(1);
                    }));
            assertThat(steps.getLast()).isEqualTo(new RoundStep.FreeSpinsEnd(100));
            assertThat(round.freeSpinsPlayed()).isEqualTo(10);
            assertThat(round.totalWin()).isEqualTo(60 + 100);
            assertThat(steps).filteredOn(RoundStep.Spin.class::isInstance).hasSize(11);
        }

        @Test
        @DisplayName("3 scattery w darmowych spinach: +10 spinów, łącznie najwyżej 50")
        void retriggerUpToLimit() {
            GameMath math = math(new String[][]{THREE_SCATTERS});

            RoundResult round = S2.playRound(math, 30, ScriptedRandom.constant(0));

            assertThat(round.freeSpinsPlayed()).isEqualTo(50);
            assertThat(round.steps()).filteredOn(RoundStep.FreeSpinsRetrigger.class::isInstance)
                    .extracting(step -> ((RoundStep.FreeSpinsRetrigger) step).added())
                    .containsExactly(10, 10, 10, 10);
            // każdy spin (bazowy i 50 darmowych) płaci za 3 scattery 2 × zakład
            assertThat(round.totalWin()).isEqualTo(51 * 60);
        }

        @Test
        @DisplayName("limit wygranej w darmowych spinach: maxWin, a potem freeSpinsEnd (pozostałe spiny przepadają)")
        void maxWinStopsFreeSpins() {
            LinesEngine capped = new LinesEngine("test", new LinesRules(1, 0, new FreeSpinsRules(3, 10, 3, 10, 50),
                    true, 2, 5, LinesRules.Anticipation.NONE), null);
            GameMath math = math(new String[][]{THREE_SCATTERS});

            RoundResult round = capped.playRound(math, 30, ScriptedRandom.constant(0));

            assertThat(round.totalWin()).isEqualTo(150);
            assertThat(round.freeSpinsPlayed()).isEqualTo(2);
            List<RoundStep> steps = round.steps();
            assertThat(steps.get(steps.size() - 2)).isEqualTo(new RoundStep.Feature("maxWin", 5, null, null));
            assertThat(steps.getLast()).isEqualTo(new RoundStep.FreeSpinsEnd(90));
        }

        @Test
        @DisplayName("antycypacja S2: 2 scattery na pierwszych bębnach → zwalniają wszystkie kolejne")
        void scatterAnticipation() {
            GameMath math = math(new String[][]{{"s,b,c", "b,s,d", "c,d,e", "d,e,a", "e,a,b"}});

            RoundResult round = S2.playRound(math, 30, ScriptedRandom.constant(0));

            assertThat(((RoundStep.Spin) round.steps().getFirst()).anticipation()).containsExactly(2, 3, 4);
        }
    }

    @Test
    @DisplayName("odtwarzalność: ten sam seed → identyczny przebieg rundy (JSON), inny seed → inna runda")
    void replayFromSeed() {
        GameMath math = s1Math(new String[][]{{"x,y,z", "w,x,y", "z,w,x"}, {"y,z,w", "x,y,z", "w,z,y"}});

        String first = RoundJson.stepsDocument(S1.playRound(math, 50, RandomSource.fromSeed(42)).steps());
        String replay = RoundJson.stepsDocument(S1.playRound(math, 50, RandomSource.fromSeed(42)).steps());

        assertThat(replay).isEqualTo(first);
        long distinct = LongStream.range(0, 50)
                .mapToObj(seed -> RoundJson.stepsDocument(S1.playRound(math, 50, RandomSource.fromSeed(seed)).steps()))
                .distinct().count();
        assertThat(distinct).isGreaterThan(10);
    }
}
