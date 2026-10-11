package pl.wsb.kasyno.slots.application.engine;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import pl.wsb.kasyno.slots.application.engine.EngineFixtures.ScriptedRandom;
import pl.wsb.kasyno.slots.domain.SlotMachine;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static pl.wsb.kasyno.slots.application.engine.EngineFixtures.clusterMachine;
import static pl.wsb.kasyno.slots.application.engine.EngineFixtures.symbols;

/**
 * Konkretne układy w grze klastrowej na planszy 6×5. Testowa gra ma symbole {@code a..g} (indeksy 0–6), scatter
 * (7) i kulę mnożnika (8), wszystkie z wagą 1: zaplanowana liczba losowa = indeks symbolu, więc test „rysuje”
 * dokładną planszę. Tło planszy to wzór {@code 1 + (2·bęben + rząd) mod 6} (symbole b..g), w którym żadne dwa
 * sąsiednie pola nie są takie same, więc jedynymi klastrami są te, które test celowo dorysuje.
 */
@DisplayName("ClusterEngine: klastry, kaskady, kule mnożników, darmowe spiny S3")
class ClusterEngineTest {

    private static final int A = 0;
    private static final int SCATTER = 7;
    private static final int ORB = 8;
    private static final long BET = 20;

    private static final ClusterRules RULES = new ClusterRules(5, new FreeSpinsRules(4, 10, 3, 5, 50),
            List.of(new ClusterRules.OrbValue(2, 1), new ClusterRules.OrbValue(3, 1),
                    new ClusterRules.OrbValue(5, 1), new ClusterRules.OrbValue(10, 1)), 10_000);

    private final ClusterEngine engine = new ClusterEngine("test", RULES, null);
    private final GameMath math = math();

    private static GameMath math() {
        SlotMachine machine = clusterMachine();
        String pays = "5:1,6:2,8:5";
        return GameMath.of(machine, symbols(machine,
                "a NORMAL 1 " + pays, "b NORMAL 1 " + pays, "c NORMAL 1 " + pays, "d NORMAL 1 " + pays,
                "e NORMAL 1 " + pays, "f NORMAL 1 " + pays, "g NORMAL 1 " + pays,
                "s SCATTER 1 4:3", "m MULTIPLIER 1"));
    }

    private static int background(int reel, int row) {
        return 1 + (2 * reel + row) % 6;
    }

    /** Plansza: tło + nadpisane pola {@code {bęben, rząd, symbol}}. */
    private static int[][] board(int[]... overrides) {
        int[][] grid = new int[6][5];
        for (int reel = 0; reel < 6; reel++) {
            for (int row = 0; row < 5; row++) {
                grid[reel][row] = background(reel, row);
            }
        }
        for (int[] cell : overrides) {
            grid[cell[0]][cell[1]] = cell[2];
        }
        return grid;
    }

    /** Kolejne liczby losowe dla zrzutu planszy (kolumnami, od góry); po kuli mnożnika indeks jej wartości. */
    private static int[] draws(int[][] grid, Map<String, Integer> orbValueIndex) {
        List<Integer> draws = new ArrayList<>();
        for (int reel = 0; reel < 6; reel++) {
            for (int row = 0; row < 5; row++) {
                draws.add(grid[reel][row]);
                if (grid[reel][row] == ORB) {
                    draws.add(orbValueIndex.get(reel + "," + row));
                }
            }
        }
        return draws.stream().mapToInt(Integer::intValue).toArray();
    }

    private static int[] draws(int[][] grid) {
        return draws(grid, Map.of());
    }

    @Test
    @DisplayName("klaster 5 płaci, grupa 4 takich samych nie płaci")
    void clusterOfFivePaysFourDoesNot() {
        int[][] grid = board(new int[]{0, 0, A}, new int[]{0, 1, A}, new int[]{0, 2, A}, new int[]{0, 3, A},
                new int[]{0, 4, A}, new int[]{3, 0, A}, new int[]{3, 1, A}, new int[]{3, 2, A}, new int[]{3, 3, A});

        List<WinItem.Cluster> clusters = engine.findClusters(math, grid, BET);

        assertThat(clusters).singleElement().satisfies(cluster -> {
            assertThat(cluster.symbol()).isEqualTo("a");
            assertThat(cluster.size()).isEqualTo(5);
            assertThat(cluster.positions()).isDeepEqualTo(new int[][]{{0, 0}, {0, 1}, {0, 2}, {0, 3}, {0, 4}});
            assertThat(cluster.amount()).isEqualTo(20);
        });
    }

    @Test
    @DisplayName("połączenie po skosie się nie liczy; scattery i kule mnożników nie tworzą klastrów")
    void onlyOrthogonalNormalSymbols() {
        int[][] diagonal = board(new int[]{0, 0, A}, new int[]{1, 1, A}, new int[]{2, 2, A}, new int[]{3, 3, A},
                new int[]{4, 4, A});
        int[][] specials = board(new int[]{0, 0, SCATTER}, new int[]{0, 1, SCATTER}, new int[]{0, 2, SCATTER},
                new int[]{0, 3, SCATTER}, new int[]{0, 4, SCATTER}, new int[]{1, 0, ORB}, new int[]{1, 1, ORB},
                new int[]{1, 2, ORB}, new int[]{1, 3, ORB}, new int[]{1, 4, ORB});

        assertThat(engine.findClusters(math, diagonal, BET)).isEmpty();
        assertThat(engine.findClusters(math, specials, BET)).isEmpty();
    }

    @Test
    @DisplayName("klaster 7 płaci jak najbliższy niższy próg tabeli (6: 2× zakładu)")
    void clusterPaysHighestThresholdNotAboveSize() {
        int[][] grid = board(new int[]{0, 0, A}, new int[]{0, 1, A}, new int[]{0, 2, A}, new int[]{0, 3, A},
                new int[]{0, 4, A}, new int[]{1, 0, A}, new int[]{1, 1, A});

        assertThat(engine.findClusters(math, grid, BET)).singleElement().satisfies(cluster -> {
            assertThat(cluster.size()).isEqualTo(7);
            assertThat(cluster.amount()).isEqualTo(40);
        });
    }

    @Test
    @DisplayName("kaskada: wygrane pola pękają, reszta opada, nowe symbole spadają od góry")
    void cascadeDropsSymbols() {
        // klaster w kształcie L: bęben 0 rzędy 2–4 i bęben 1 rzędy 3–4
        int[][] grid = board(new int[]{0, 2, A}, new int[]{0, 3, A}, new int[]{0, 4, A}, new int[]{1, 3, A},
                new int[]{1, 4, A});
        // dolosowanie: bęben 0 dostaje d,e,f (3 pola), bęben 1 dostaje b,c (2 pola)
        ScriptedRandom random = ScriptedRandom.cycling(1, 6).then(draws(grid)).then(3, 4, 5, 1, 2);

        RoundResult round = engine.playRound(math, BET, random);

        assertThat(random.exhausted()).isTrue();
        assertThat(round.steps()).hasSize(3);
        assertThat(round.steps().get(0)).isInstanceOfSatisfying(RoundStep.Spin.class, spin -> {
            assertThat(spin.orbs()).isEmpty();
            assertThat(spin.anticipation()).isEmpty();
        });
        assertThat(round.steps().get(1)).isInstanceOfSatisfying(RoundStep.Win.class, win -> {
            assertThat(win.win()).isEqualTo(20);
            assertThat(win.wins()).singleElement().isInstanceOfSatisfying(WinItem.Cluster.class, cluster ->
                    assertThat(cluster.positions()).isDeepEqualTo(new int[][]{{0, 2}, {0, 3}, {0, 4}, {1, 3}, {1, 4}}));
        });
        assertThat(round.steps().get(2)).isInstanceOfSatisfying(RoundStep.Cascade.class, cascade -> {
            assertThat(cascade.removed()).isDeepEqualTo(new int[][]{{0, 2}, {0, 3}, {0, 4}, {1, 3}, {1, 4}});
            assertThat(cascade.newSymbols()).containsExactly(List.of("d", "e", "f"), List.of("b", "c"),
                    List.of(), List.of(), List.of(), List.of());
            // bęben 0: nowe d,e,f nad tymi, które zostały (b,c); bęben 1: nowe b,c nad opadłymi d,e,f
            assertThat(cascade.grid()[0]).containsExactly("d", "e", "f", "b", "c");
            assertThat(cascade.grid()[1]).containsExactly("b", "c", "d", "e", "f");
            assertThat(cascade.orbs()).isEmpty();
        });
        assertThat(round.totalWin()).isEqualTo(20);
        assertThat(RoundJson.stepsDocument(round.steps()))
                .contains("{\"type\":\"spin\",\"phase\":\"base\",\"grid\":[[\"b\",\"c\",\"a\",\"a\",\"a\"],")
                .contains("\"anticipation\":[],\"orbs\":[]}")
                .contains("{\"type\":\"cascade\",\"removed\":[[0,2],[0,3],[0,4],[1,3],[1,4]],"
                        + "\"newSymbols\":[[\"d\",\"e\",\"f\"],[\"b\",\"c\"],[],[],[],[]],");
    }

    @Test
    @DisplayName("4 scattery → 10 darmowych spinów; suma kul mnoży wygraną sekwencji (applyMultiplier)")
    void freeSpinsWithMultiplierOrbs() {
        int[][] base = board(new int[]{0, 0, SCATTER}, new int[]{1, 0, SCATTER}, new int[]{2, 0, SCATTER},
                new int[]{3, 0, SCATTER});
        // darmowy spin 1: klaster a w bębnie 0 i dwie kule: ×3 na [3,0] i ×5 na [5,4]
        int[][] free = board(new int[]{0, 0, A}, new int[]{0, 1, A}, new int[]{0, 2, A}, new int[]{0, 3, A},
                new int[]{0, 4, A}, new int[]{3, 0, ORB}, new int[]{5, 4, ORB});
        ScriptedRandom random = ScriptedRandom.cycling(1, 6)
                .then(draws(base))
                .then(draws(free, Map.of("3,0", 1, "5,4", 2)))
                .then(1, 2, 3, 4, 5);

        RoundResult round = engine.playRound(math, BET, random);

        List<RoundStep> steps = round.steps();
        assertThat(((RoundStep.Spin) steps.get(0)).anticipation()).containsExactly(3, 4, 5);
        assertThat(steps.get(1)).isInstanceOfSatisfying(RoundStep.Win.class, win ->
                assertThat(win.wins()).singleElement().isInstanceOfSatisfying(WinItem.Scatter.class, scatter -> {
                    assertThat(scatter.count()).isEqualTo(4);
                    assertThat(scatter.amount()).isEqualTo(60);
                }));
        assertThat(steps.get(2)).isInstanceOfSatisfying(RoundStep.FreeSpinsStart.class, start -> {
            assertThat(start.count()).isEqualTo(10);
            assertThat(start.trigger()).isDeepEqualTo(new int[][]{{0, 0}, {1, 0}, {2, 0}, {3, 0}});
        });
        assertThat(steps.get(3)).isInstanceOfSatisfying(RoundStep.Spin.class, spin -> {
            assertThat(spin.phase()).isEqualTo("free");
            assertThat(spin.orbs()).extracting(RoundStep.Orb::value).containsExactly(3, 5);
            assertThat(spin.orbs().get(1).pos()).containsExactly(5, 4);
        });
        assertThat(steps.get(4)).isInstanceOf(RoundStep.Win.class);
        assertThat(steps.get(5)).isInstanceOf(RoundStep.Cascade.class);
        // wygrana sekwencji 20 × (3 + 5) = 160, czyli krok dodaje 140
        assertThat(steps.get(6)).isEqualTo(new RoundStep.ApplyMultiplier(8, 20, 140, 220));
        assertThat(steps.getLast()).isEqualTo(new RoundStep.FreeSpinsEnd(160));
        assertThat(round.freeSpinsPlayed()).isEqualTo(10);
        assertThat(round.totalWin()).isEqualTo(220);
    }

    @Test
    @DisplayName("3 scattery w darmowym spinie → +5 spinów (freeSpinsRetrigger)")
    void retriggerInFreeSpins() {
        int[][] base = board(new int[]{0, 0, SCATTER}, new int[]{1, 0, SCATTER}, new int[]{2, 0, SCATTER},
                new int[]{3, 0, SCATTER});
        int[][] free = board(new int[]{0, 0, SCATTER}, new int[]{2, 2, SCATTER}, new int[]{4, 4, SCATTER});
        ScriptedRandom random = ScriptedRandom.cycling(1, 6).then(draws(base)).then(draws(free));

        RoundResult round = engine.playRound(math, BET, random);

        assertThat(round.steps().get(3)).isInstanceOfSatisfying(RoundStep.Spin.class, spin ->
                assertThat(spin.anticipation()).containsExactly(3, 4, 5));
        assertThat(round.steps().get(4)).isInstanceOfSatisfying(RoundStep.FreeSpinsRetrigger.class, retrigger -> {
            assertThat(retrigger.added()).isEqualTo(5);
            assertThat(retrigger.freeSpinsLeft()).isEqualTo(14);
            assertThat(retrigger.trigger()).isDeepEqualTo(new int[][]{{0, 0}, {2, 2}, {4, 4}});
        });
        assertThat(round.freeSpinsPlayed()).isEqualTo(15);
    }

    @Test
    @DisplayName("limit maksymalnej wygranej: bez dalszych kaskad, krok maxWin")
    void maxWinStopsCascades() {
        ClusterEngine capped = new ClusterEngine("test", new ClusterRules(5, RULES.freeSpins(), RULES.orbValues(), 1),
                null);
        int[][] grid = board(new int[]{0, 2, A}, new int[]{0, 3, A}, new int[]{0, 4, A}, new int[]{1, 3, A},
                new int[]{1, 4, A});

        RoundResult round = capped.playRound(math, BET, ScriptedRandom.cycling(1, 6).then(draws(grid)));

        assertThat(round.steps()).hasSize(3);
        assertThat(round.steps().get(2)).isEqualTo(new RoundStep.Feature("maxWin", 1, null, null));
        assertThat(round.totalWin()).isEqualTo(BET);
        assertThat(round.maxWinReached()).isTrue();
    }

    @Test
    @DisplayName("odtwarzalność: ten sam seed → identyczny przebieg (także z kaskadami i darmowymi spinami)")
    void replayFromSeed() {
        for (long seed = 0; seed < 200; seed++) {
            String first = RoundJson.stepsDocument(engine.playRound(math, BET, RandomSource.fromSeed(seed)).steps());
            String replay = RoundJson.stepsDocument(engine.playRound(math, BET, RandomSource.fromSeed(seed)).steps());
            assertThat(replay).isEqualTo(first);
        }
    }
}
