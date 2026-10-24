package pl.wsb.kasyno.slots.application.engine;

import pl.wsb.kasyno.slots.entity.SymbolKind;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Silnik gry klastrowej z kaskadami: Kryształowa Kaskada (6 bębnów × 5 rzędów).
 *
 * <p>Przebieg rundy:
 * <ol>
 *   <li><b>zrzut planszy</b>: każde pole losujemy niezależnie z wag symboli ({@code slot_symbol.weight});</li>
 *   <li><b>klastry</b>: grupa co najmniej {@code minClusterSize} takich samych zwykłych symboli połączonych bokami
 *       (góra/dół/lewo/prawo, nie po skosie) płaci mnożnik z tabeli za swój rozmiar × zakład całkowity;</li>
 *   <li><b>kaskada</b>: symbole z wygranych klastrów pękają, pozostałe opadają w dół, a puste miejsca u góry
 *       wypełniają nowe losowe symbole; ocena powtarza się, dopóki powstają klastry („sekwencja kaskad”);</li>
 *   <li><b>scatter</b> (nigdy nie pęka) liczony na końcu sekwencji: płaci za liczbę × zakład, a 4+ uruchamia
 *       darmowe spiny;</li>
 *   <li><b>darmowe spiny</b>: na planszę mogą spaść kule mnożników (×2 … ×100). Kule nie tworzą klastrów i nie
 *       pękają; na końcu sekwencji kaskad ich suma mnoży wygraną tej sekwencji (krok {@code applyMultiplier}).
 *       3+ scattery w darmowym spinie dodają spiny.</li>
 * </ol>
 */
public class ClusterEngine extends ConfiguredSlotEngine {

    private final ClusterRules rules;
    private final int[] orbValues;
    private final int[] orbCumulativeWeights;

    public ClusterEngine(String gameCode, ClusterRules rules, GameMathProvider mathProvider) {
        super(gameCode, mathProvider);
        this.rules = rules;
        List<ClusterRules.OrbValue> orbs = rules.orbValues();
        this.orbValues = new int[orbs.size()];
        this.orbCumulativeWeights = new int[orbs.size()];
        int total = 0;
        for (int i = 0; i < orbs.size(); i++) {
            orbValues[i] = orbs.get(i).value();
            total += orbs.get(i).weight();
            orbCumulativeWeights[i] = total;
        }
    }

    public ClusterRules rules() {
        return rules;
    }

    @Override
    public RoundResult playRound(GameMath math, long bet, RandomSource random) {
        RoundBuilder round = new RoundBuilder(bet, rules.maxWinMultiplier());
        Board board = drop(math, false, random);
        round.add(new RoundStep.Spin("base", Grids.codes(math, board.symbols), anticipation(math, board, false),
                null, null, board.orbs()));
        cascadeSequence(math, board, bet, false, random, round);
        if (round.stopAtMaxWin()) {
            return round.build();
        }
        int[][] scatters = Grids.positionsOf(board.symbols, math.scatter());
        LinesEngine.recordWins(round, scatterWins(math, scatters, bet));
        if (round.stopAtMaxWin()) {
            return round.build();
        }
        if (scatters.length >= rules.freeSpins().triggerCount()) {
            playFreeSpins(math, bet, random, round, scatters);
        }
        return round.build();
    }

    private void playFreeSpins(GameMath math, long bet, RandomSource random, RoundBuilder round, int[][] trigger) {
        FreeSpinsRules freeSpins = rules.freeSpins();
        round.freeSpinsTriggered();
        round.add(new RoundStep.FreeSpinsStart(freeSpins.awarded(), trigger));
        int left = freeSpins.awarded();
        int awarded = freeSpins.awarded();
        int index = 0;
        while (left > 0) {
            index++;
            left--;
            round.freeSpinPlayed();
            Board board = drop(math, true, random);
            round.add(new RoundStep.Spin("free", Grids.codes(math, board.symbols), anticipation(math, board, true),
                    index, left, board.orbs()));
            long sequenceWin = cascadeSequence(math, board, bet, true, random, round);
            round.addFreeSpinsWin(sequenceWin);
            if (round.stopAtMaxWin()) {
                break;
            }
            int orbsSum = board.orbsSum();
            if (orbsSum > 0 && sequenceWin > 0) {
                long extra = round.addWin(sequenceWin * (orbsSum - 1));
                round.addFreeSpinsWin(extra);
                round.add(new RoundStep.ApplyMultiplier(orbsSum, sequenceWin, extra, round.totalWin()));
                if (round.stopAtMaxWin()) {
                    break;
                }
            }
            int[][] scatters = Grids.positionsOf(board.symbols, math.scatter());
            round.addFreeSpinsWin(LinesEngine.recordWins(round, scatterWins(math, scatters, bet)));
            if (round.stopAtMaxWin()) {
                break;
            }
            if (scatters.length >= freeSpins.retriggerCount() && awarded < freeSpins.maxTotal()) {
                int added = Math.min(freeSpins.retriggerAwarded(), freeSpins.maxTotal() - awarded);
                awarded += added;
                left += added;
                round.add(new RoundStep.FreeSpinsRetrigger(added, scatters, left));
            }
        }
        round.add(new RoundStep.FreeSpinsEnd(round.freeSpinsWin()));
    }

    /**
     * Sekwencja kaskad: ocena klastrów → pęknięcie → opad → ocena … aż do planszy bez klastrów.
     *
     * @return suma wygranych klastrów z tej sekwencji (podstawa dla kul mnożników)
     */
    private long cascadeSequence(GameMath math, Board board, long bet, boolean free, RandomSource random,
                                 RoundBuilder round) {
        long sequenceWin = 0;
        while (true) {
            List<WinItem.Cluster> clusters = findClusters(math, board.symbols, bet);
            if (clusters.isEmpty()) {
                return sequenceWin;
            }
            sequenceWin += LinesEngine.recordWins(round, new ArrayList<>(clusters));
            if (round.maxWinReached()) {
                // limit wygranej: bez dalszych kaskad; krok maxWin dopisze wywołujący (stopAtMaxWin)
                return sequenceWin;
            }
            round.add(cascade(math, board, clusters, free, random));
        }
    }

    /**
     * Wszystkie klastry na planszy (przeszukiwanie wszerz po sąsiadach bokami). Metoda czysta, testowana na ręcznie
     * zbudowanych planszach (klaster 5 płaci, 4 nie; połączenie po skosie się nie liczy).
     */
    public List<WinItem.Cluster> findClusters(GameMath math, int[][] grid, long bet) {
        int reels = grid.length;
        int rows = grid[0].length;
        boolean[][] visited = new boolean[reels][rows];
        int[] queue = new int[reels * rows];
        List<WinItem.Cluster> clusters = new ArrayList<>();
        for (int reel = 0; reel < reels; reel++) {
            for (int row = 0; row < rows; row++) {
                int symbol = grid[reel][row];
                if (visited[reel][row] || math.kind(symbol) != SymbolKind.NORMAL) {
                    continue;
                }
                int size = 0;
                int head = 0;
                queue[size++] = reel * rows + row;
                visited[reel][row] = true;
                while (head < size) {
                    int cell = queue[head++];
                    int r = cell / rows;
                    int c = cell % rows;
                    size = visit(grid, visited, queue, size, symbol, r - 1, c, rows);
                    size = visit(grid, visited, queue, size, symbol, r + 1, c, rows);
                    size = visit(grid, visited, queue, size, symbol, r, c - 1, rows);
                    size = visit(grid, visited, queue, size, symbol, r, c + 1, rows);
                }
                if (size >= rules.minClusterSize()) {
                    int[] cells = Arrays.copyOf(queue, size);
                    Arrays.sort(cells);
                    int[][] positions = new int[size][];
                    for (int i = 0; i < size; i++) {
                        positions[i] = new int[]{cells[i] / rows, cells[i] % rows};
                    }
                    long amount = math.atLeastPay(symbol, size) * bet / 100;
                    clusters.add(new WinItem.Cluster(math.code(symbol), size, positions, amount));
                }
            }
        }
        return clusters;
    }

    private static int visit(int[][] grid, boolean[][] visited, int[] queue, int size, int symbol, int reel, int row,
                             int rows) {
        if (reel < 0 || reel >= grid.length || row < 0 || row >= rows || visited[reel][row]
                || grid[reel][row] != symbol) {
            return size;
        }
        visited[reel][row] = true;
        queue[size] = reel * rows + row;
        return size + 1;
    }

    /** Pęknięcie wygranych pól, opad pozostałych symboli (razem z kulami) i dolosowanie nowych od góry. */
    private RoundStep.Cascade cascade(GameMath math, Board board, List<WinItem.Cluster> clusters, boolean free,
                                      RandomSource random) {
        int reels = board.symbols.length;
        int rows = board.symbols[0].length;
        boolean[][] removed = new boolean[reels][rows];
        int removedCount = 0;
        for (WinItem.Cluster cluster : clusters) {
            for (int[] pos : cluster.positions()) {
                removed[pos[0]][pos[1]] = true;
                removedCount++;
            }
        }
        int[][] removedPositions = new int[removedCount][];
        int next = 0;
        List<List<String>> newSymbols = new ArrayList<>(reels);
        List<RoundStep.Orb> newOrbs = new ArrayList<>();
        for (int reel = 0; reel < reels; reel++) {
            int[] keptSymbols = new int[rows];
            int[] keptOrbs = new int[rows];
            int kept = 0;
            for (int row = 0; row < rows; row++) {
                if (removed[reel][row]) {
                    removedPositions[next++] = new int[]{reel, row};
                } else {
                    keptSymbols[kept] = board.symbols[reel][row];
                    keptOrbs[kept] = board.orbValues[reel][row];
                    kept++;
                }
            }
            int fresh = rows - kept;
            List<String> column = new ArrayList<>(fresh);
            for (int row = 0; row < fresh; row++) {
                int symbol = math.drawSymbol(random, free);
                board.symbols[reel][row] = symbol;
                board.orbValues[reel][row] = symbol == math.multiplier() ? drawOrbValue(random) : 0;
                column.add(math.code(symbol));
                if (board.orbValues[reel][row] > 0) {
                    newOrbs.add(new RoundStep.Orb(new int[]{reel, row}, board.orbValues[reel][row]));
                }
            }
            for (int i = 0; i < kept; i++) {
                board.symbols[reel][fresh + i] = keptSymbols[i];
                board.orbValues[reel][fresh + i] = keptOrbs[i];
            }
            newSymbols.add(column);
        }
        return new RoundStep.Cascade(removedPositions, newSymbols, Grids.codes(math, board.symbols), newOrbs);
    }

    private List<WinItem> scatterWins(GameMath math, int[][] scatters, long bet) {
        if (scatters.length == 0) {
            return List.of();
        }
        long pay = math.atLeastPay(math.scatter(), scatters.length);
        return pay > 0
                ? List.of(new WinItem.Scatter(math.code(math.scatter()), scatters.length, scatters, pay * bet / 100))
                : List.of();
    }

    /** Nowa plansza: każde pole losowane niezależnie (kolejno bęben po bębnie, od góry). */
    private Board drop(GameMath math, boolean free, RandomSource random) {
        Board board = new Board(math.reels(), math.rows());
        for (int reel = 0; reel < math.reels(); reel++) {
            for (int row = 0; row < math.rows(); row++) {
                int symbol = math.drawSymbol(random, free);
                board.symbols[reel][row] = symbol;
                board.orbValues[reel][row] = symbol == math.multiplier() ? drawOrbValue(random) : 0;
            }
        }
        return board;
    }

    private int drawOrbValue(RandomSource random) {
        int roll = random.nextInt(orbCumulativeWeights[orbCumulativeWeights.length - 1]);
        int index = 0;
        while (orbCumulativeWeights[index] <= roll) {
            index++;
        }
        return orbValues[index];
    }

    private List<Integer> anticipation(GameMath math, Board board, boolean free) {
        FreeSpinsRules freeSpins = rules.freeSpins();
        int needed = free ? freeSpins.retriggerCount() : freeSpins.triggerCount();
        return Grids.scatterAnticipation(board.symbols, math.scatter(), needed - 1);
    }

    /** Plansza w trakcie sekwencji kaskad: symbole i wartości kul (0 = pole bez kuli). */
    private static final class Board {

        final int[][] symbols;
        final int[][] orbValues;

        Board(int reels, int rows) {
            this.symbols = new int[reels][rows];
            this.orbValues = new int[reels][rows];
        }

        List<RoundStep.Orb> orbs() {
            List<RoundStep.Orb> orbs = new ArrayList<>();
            for (int reel = 0; reel < orbValues.length; reel++) {
                for (int row = 0; row < orbValues[reel].length; row++) {
                    if (orbValues[reel][row] > 0) {
                        orbs.add(new RoundStep.Orb(new int[]{reel, row}, orbValues[reel][row]));
                    }
                }
            }
            return orbs;
        }

        int orbsSum() {
            int sum = 0;
            for (int[] reel : orbValues) {
                for (int value : reel) {
                    sum += value;
                }
            }
            return sum;
        }
    }
}
