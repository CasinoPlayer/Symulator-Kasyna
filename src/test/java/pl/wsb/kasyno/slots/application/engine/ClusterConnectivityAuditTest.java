package pl.wsb.kasyno.slots.application.engine;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import pl.wsb.kasyno.slots.application.engine.EngineFixtures.ScriptedRandom;
import pl.wsb.kasyno.slots.domain.SlotMachine;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static pl.wsb.kasyno.slots.application.engine.EngineFixtures.clusterMachine;
import static pl.wsb.kasyno.slots.application.engine.EngineFixtures.grid;
import static pl.wsb.kasyno.slots.application.engine.EngineFixtures.symbols;

/** Ręcznie rozrysowane przypadki: liczy się spójna grupa, a nie suma symboli na ekranie. */
@DisplayName("Audyt połączeń S3: rozdzielone grupy, skosy, kształty i kolejne kaskady")
class ClusterConnectivityAuditTest {

    private static final long BET = 20;
    private static final ClusterRules RULES = new ClusterRules(5, new FreeSpinsRules(4, 10, 3, 5, 50),
            List.of(new ClusterRules.OrbValue(2, 1)), 10_000);

    private final ClusterEngine engine = new ClusterEngine("test", RULES, null);
    private final GameMath math = math();

    private static GameMath math() {
        SlotMachine machine = clusterMachine();
        return GameMath.of(machine, symbols(machine,
                "a NORMAL 1 5:1,6:2,8:5", "b NORMAL 1 5:3,6:4,8:6",
                "c NORMAL 1 5:1", "d NORMAL 1 5:1", "e NORMAL 1 5:1",
                "f NORMAL 1 5:1", "g NORMAL 1 5:1", "s SCATTER 1 4:3", "m MULTIPLIER 1"));
    }

    /** Tło nie zawiera a ani równych sąsiadów bokami; pozycje zapisujemy jako [kolumna, rząd]. */
    private int[][] withA(int[]... positions) {
        int[][] board = grid(math, "b,c,d,e,f", "d,e,f,g,b", "f,g,b,c,d",
                "b,c,d,e,f", "d,e,f,g,b", "f,g,b,c,d");
        for (int[] position : positions) {
            board[position[0]][position[1]] = 0;
        }
        return board;
    }

    @Test
    @DisplayName("3 + 2 rozdzielone symbole nie stają się jednym płatnym klastrem 5")
    void disconnectedThreeAndTwoDoNotPay() {
        int[][] board = withA(new int[]{0, 0}, new int[]{0, 1}, new int[]{0, 2},
                new int[]{4, 3}, new int[]{4, 4});

        assertThat(engine.findClusters(math, board, BET)).isEmpty();
    }

    @Test
    @DisplayName("dwie grupy po 3, stykające się wyłącznie rogiem, nie płacą")
    void twoGroupsOfThreeTouchingOnlyDiagonallyDoNotPay() {
        // Jedyne zetknięcie grup: [0,2] z [1,3], czyli po skosie.
        int[][] board = withA(new int[]{0, 0}, new int[]{0, 1}, new int[]{0, 2},
                new int[]{1, 3}, new int[]{1, 4}, new int[]{2, 4});

        assertThat(engine.findClusters(math, board, BET)).isEmpty();
    }

    @Test
    @DisplayName("5 symboli w kształcie T albo L płaci raz za całą grupę")
    void connectedNonStraightShapesPayOnce() {
        List<int[][]> shapes = List.of(
                new int[][]{{1, 1}, {2, 1}, {2, 2}, {2, 3}, {3, 1}},
                new int[][]{{1, 1}, {1, 2}, {1, 3}, {2, 3}, {3, 3}});

        for (int[][] positions : shapes) {
            assertThat(engine.findClusters(math, withA(positions), BET)).singleElement().satisfies(cluster -> {
                assertThat(cluster.symbol()).isEqualTo("a");
                assertThat(cluster.size()).isEqualTo(5);
                assertThat(cluster.positions()).isDeepEqualTo(positions);
                assertThat(cluster.amount()).isEqualTo(20);
            });
        }
    }

    @Test
    @DisplayName("oddzielne klastry tego samego symbolu (6 i 5) mają dwie osobne wypłaty")
    void disconnectedPayingClustersRemainSeparate() {
        int[][] board = withA(new int[]{0, 0}, new int[]{0, 1}, new int[]{0, 2}, new int[]{0, 3},
                new int[]{0, 4}, new int[]{1, 4}, new int[]{4, 0}, new int[]{4, 1}, new int[]{4, 2},
                new int[]{4, 3}, new int[]{4, 4});

        List<WinItem.Cluster> wins = engine.findClusters(math, board, BET);

        assertThat(wins).hasSize(2);
        assertThat(wins).extracting(WinItem.Cluster::symbol).containsExactly("a", "a");
        assertThat(wins).extracting(WinItem.Cluster::size).containsExactly(6, 5);
        assertThat(wins).extracting(WinItem.Cluster::amount).containsExactly(40L, 20L);
        assertThat(wins.get(0).positions()).isDeepEqualTo(
                new int[][]{{0, 0}, {0, 1}, {0, 2}, {0, 3}, {0, 4}, {1, 4}});
        assertThat(wins.get(1).positions()).isDeepEqualTo(
                new int[][]{{4, 0}, {4, 1}, {4, 2}, {4, 3}, {4, 4}});
    }

    @Test
    @DisplayName("nowe symbole łączą się ze starym po opadzie: runda płaci 20 + 60 = 80")
    void cascadeJoinsNewSymbolsToSurvivorAndAddsBothWins() {
        int[][] initial = grid(math, "b,c,a,a,a", "d,e,f,a,a", "f,g,b,c,d",
                "b,c,d,e,f", "d,e,f,g,b", "f,g,b,c,d");
        ScriptedRandom random = ScriptedRandom.cycling(1, 6)
                .then(Arrays.stream(initial).flatMapToInt(Arrays::stream).toArray())
                // Po pęknięciu 5 a: trzy nowe b w kolumnie 0 i b,c w kolumnie 1.
                // Stare b z [0,0] opada do [0,3] i łączy cztery nowe b w klaster 5.
                .then(1, 1, 1, 1, 2)
                // Po pęknięciu 5 b: b,c,d,e w kolumnie 0 i g w kolumnie 1 kończą sekwencję.
                .then(1, 2, 3, 4, 6);

        RoundResult round = engine.playRound(math, BET, random);

        assertThat(random.exhausted()).isTrue();
        assertThat(round.steps()).hasSize(5);
        assertThat(round.steps().get(0)).isInstanceOf(RoundStep.Spin.class);
        assertThat(round.steps().get(1)).isInstanceOfSatisfying(RoundStep.Win.class, win -> {
            assertThat(win.win()).isEqualTo(20);
            assertThat(win.totalWin()).isEqualTo(20);
            assertThat(win.wins()).singleElement().isInstanceOfSatisfying(WinItem.Cluster.class, cluster -> {
                assertThat(cluster.symbol()).isEqualTo("a");
                assertThat(cluster.size()).isEqualTo(5);
                assertThat(cluster.amount()).isEqualTo(20);
                assertThat(cluster.positions()).isDeepEqualTo(
                        new int[][]{{0, 2}, {0, 3}, {0, 4}, {1, 3}, {1, 4}});
            });
        });
        assertThat(round.steps().get(2)).isInstanceOfSatisfying(RoundStep.Cascade.class, cascade -> {
            assertThat(cascade.removed()).isDeepEqualTo(
                    new int[][]{{0, 2}, {0, 3}, {0, 4}, {1, 3}, {1, 4}});
            assertThat(cascade.newSymbols()).containsExactly(List.of("b", "b", "b"), List.of("b", "c"),
                    List.of(), List.of(), List.of(), List.of());
            assertThat(cascade.grid()).isDeepEqualTo(new String[][]{
                    {"b", "b", "b", "b", "c"}, {"b", "c", "d", "e", "f"},
                    {"f", "g", "b", "c", "d"}, {"b", "c", "d", "e", "f"},
                    {"d", "e", "f", "g", "b"}, {"f", "g", "b", "c", "d"}});
        });
        assertThat(round.steps().get(3)).isInstanceOfSatisfying(RoundStep.Win.class, win -> {
            assertThat(win.win()).isEqualTo(60);
            assertThat(win.totalWin()).isEqualTo(80);
            assertThat(win.wins()).singleElement().isInstanceOfSatisfying(WinItem.Cluster.class, cluster -> {
                assertThat(cluster.symbol()).isEqualTo("b");
                assertThat(cluster.size()).isEqualTo(5);
                assertThat(cluster.amount()).isEqualTo(60);
                assertThat(cluster.positions()).isDeepEqualTo(
                        new int[][]{{0, 0}, {0, 1}, {0, 2}, {0, 3}, {1, 0}});
            });
        });
        assertThat(round.steps().get(4)).isInstanceOfSatisfying(RoundStep.Cascade.class, cascade -> {
            assertThat(cascade.removed()).isDeepEqualTo(
                    new int[][]{{0, 0}, {0, 1}, {0, 2}, {0, 3}, {1, 0}});
            assertThat(cascade.newSymbols()).containsExactly(List.of("b", "c", "d", "e"), List.of("g"),
                    List.of(), List.of(), List.of(), List.of());
            assertThat(cascade.grid()[0]).containsExactly("b", "c", "d", "e", "c");
            assertThat(cascade.grid()[1]).containsExactly("g", "c", "d", "e", "f");
        });
        assertThat(round.totalWin()).isEqualTo(80);
        assertThat(round.freeSpinsTriggered()).isFalse();
        assertThat(round.maxWinReached()).isFalse();
    }
}
