package pl.wsb.kasyno.slots.application.engine;

import pl.wsb.kasyno.slots.domain.SymbolKind;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Silnik gier z liniami wygrywającymi: Cebulowy 777 (3×3, 5 linii) i Złoty Faraon (5×3, 20 linii).
 *
 * <p>Przebieg rundy:
 * <ol>
 *   <li><b>obrót</b>: dla każdego bębna losujemy pozycję zatrzymania na taśmie; w oknie widać {@code rows} kolejnych
 *       symboli (krok {@code spin});</li>
 *   <li><b>ocena linii</b>: na każdej linii liczymy symbole od lewego bębna. WILD zastępuje każdy zwykły symbol
 *       (nie scatter). Gdy linię można odczytać na kilka sposobów (np. {@code WILD WILD 7}: trzy siódemki albo
 *       dwa WILD), wybieramy <b>najwyższą</b> wygraną; na linii płaci tylko jedna kombinacja;</li>
 *   <li><b>scatter</b> płaci za liczbę w dowolnym miejscu planszy × zakład całkowity (krok {@code win});</li>
 *   <li>funkcje: „neonowy mnożnik” (wygrana linii z WILD × {@code wildLineMultiplier}), NEON JACKPOT (cała plansza
 *       jednego symbolu: wygrana linii × {@code fullScreenMultiplier}, krok {@code feature}), darmowe spiny
 *       z rozszerzającym się WILD (krok {@code expandWild}) i mnożnikiem wygranych.</li>
 * </ol>
 * Kwota linii = mnożnik z tabeli × (zakład / liczba linii) × mnożniki, ułamki w dół. Matematyka (wypłaty, taśmy,
 * linie) przychodzi z bazy przez {@link GameMath}, reguły funkcji z {@link LinesRules}.
 */
public class LinesEngine extends ConfiguredSlotEngine {

    private final LinesRules rules;

    public LinesEngine(String gameCode, LinesRules rules, GameMathProvider mathProvider) {
        super(gameCode, mathProvider);
        this.rules = rules;
    }

    public LinesRules rules() {
        return rules;
    }

    @Override
    public RoundResult playRound(GameMath math, long bet, RandomSource random) {
        RoundBuilder round = new RoundBuilder(bet, rules.maxWinMultiplier());
        int[][] grid = spinReels(math, false, random);
        round.add(new RoundStep.Spin("base", Grids.codes(math, grid), anticipation(math, grid, false),
                null, null, null));
        List<WinItem> wins = evaluate(math, grid, bet, false);
        recordWins(round, wins);
        if (round.stopAtMaxWin()) {
            return round.build();
        }
        if (rules.fullScreenMultiplier() > 1 && isFullScreen(math, grid)) {
            long lineWin = wins.stream().filter(WinItem.Line.class::isInstance).mapToLong(WinItem::amount).sum();
            long extra = round.addWin(lineWin * (rules.fullScreenMultiplier() - 1));
            round.add(new RoundStep.Feature(RoundStep.NEON_JACKPOT, rules.fullScreenMultiplier(), extra,
                    round.totalWin()));
            if (round.stopAtMaxWin()) {
                return round.build();
            }
        }
        FreeSpinsRules freeSpins = rules.freeSpins();
        if (freeSpins != null) {
            int[][] scatters = Grids.positionsOf(grid, math.scatter());
            if (scatters.length >= freeSpins.triggerCount()) {
                playFreeSpins(math, bet, random, round, scatters);
            }
        }
        return round.build();
    }

    /**
     * Darmowe spiny: rozgrywane od razu w tej samej rundzie. W każdym spinie WILD może się rozszerzyć na bęben,
     * wygrane liniowe mają mnożnik, a scattery mogą dodać kolejne spiny (do limitu łącznej liczby).
     */
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
            int[][] grid = spinReels(math, true, random);
            round.add(new RoundStep.Spin("free", Grids.codes(math, grid), anticipation(math, grid, true),
                    index, left, null));
            if (rules.expandingWildInFreeSpins()) {
                List<Integer> expanded = expandWilds(math, grid);
                if (!expanded.isEmpty()) {
                    round.add(new RoundStep.ExpandWild(expanded, Grids.codes(math, grid)));
                }
            }
            round.addFreeSpinsWin(recordWins(round, evaluate(math, grid, bet, true)));
            if (round.stopAtMaxWin()) {
                break;
            }
            int[][] scatters = Grids.positionsOf(grid, math.scatter());
            if (scatters.length >= freeSpins.retriggerCount() && awarded < freeSpins.maxTotal()) {
                int added = Math.min(freeSpins.retriggerAwarded(), freeSpins.maxTotal() - awarded);
                awarded += added;
                left += added;
                round.add(new RoundStep.FreeSpinsRetrigger(added, scatters, left));
            }
        }
        round.add(new RoundStep.FreeSpinsEnd(round.freeSpinsWin()));
    }

    /** Losuje pozycje zatrzymania bębnów i zwraca widoczną siatkę {@code [bęben][rząd]}. */
    static int[][] spinReels(GameMath math, boolean free, RandomSource random) {
        int[][] strips = math.strips(free);
        int[][] grid = new int[math.reels()][math.rows()];
        for (int reel = 0; reel < grid.length; reel++) {
            int[] strip = strips[reel];
            int stop = random.nextInt(strip.length);
            for (int row = 0; row < grid[reel].length; row++) {
                grid[reel][row] = strip[(stop + row) % strip.length];
            }
        }
        return grid;
    }

    /**
     * Wszystkie wygrane na siatce: linie (w kolejności numerów) i scatter. Metoda czysta (bez losowania i stanu),
     * więc testy konkretnych układów podają tu ręcznie zbudowaną siatkę.
     *
     * @param free {@code true} w darmowym spinie (mnożnik wygranych liniowych)
     */
    public List<WinItem> evaluate(GameMath math, int[][] grid, long bet, boolean free) {
        List<WinItem> wins = new ArrayList<>();
        int[][] paylines = math.paylines();
        int freeSpinMultiplier = free ? rules.freeSpinWinMultiplier() : 1;
        for (int index = 0; index < paylines.length; index++) {
            WinItem.Line win = evaluateLine(math, grid, paylines[index], index + 1, bet, paylines.length,
                    freeSpinMultiplier);
            if (win != null) {
                wins.add(win);
            }
        }
        int[][] scatters = Grids.positionsOf(grid, math.scatter());
        if (scatters.length > 0) {
            long pay = math.atLeastPay(math.scatter(), scatters.length);
            if (pay > 0) {
                wins.add(new WinItem.Scatter(math.code(math.scatter()), scatters.length, scatters, pay * bet / 100));
            }
        }
        return wins;
    }

    /**
     * Najwyższa wygrana na jednej linii albo {@code null}. Kandydaci: (a) same WILD od lewej, płacące jak WILD,
     * (b) pierwszy zwykły symbol od lewej razem z WILD-ami przed nim i za nim. Mnożnik WILD dotyczy tylko (b),
     * gdy WILD rzeczywiście zastąpił symbol.
     */
    private WinItem.Line evaluateLine(GameMath math, int[][] grid, int[] line, int lineNumber, long bet,
                                      int lineCount, int freeSpinMultiplier) {
        int reels = line.length;
        int wild = math.wild();
        int leadingWilds = 0;
        while (leadingWilds < reels && grid[leadingWilds][line[leadingWilds]] == wild) {
            leadingWilds++;
        }
        int bestSymbol = GameMath.NONE;
        int bestCount = 0;
        int bestWildMultiplier = 1;
        long bestValue = 0;
        if (leadingWilds > 0) {
            long pay = math.linePay(wild, leadingWilds);
            if (pay > 0) {
                bestSymbol = wild;
                bestCount = leadingWilds;
                bestValue = pay;
            }
        }
        if (leadingWilds < reels) {
            int symbol = grid[leadingWilds][line[leadingWilds]];
            if (math.kind(symbol) == SymbolKind.NORMAL) {
                int count = leadingWilds + 1;
                boolean wildUsed = leadingWilds > 0;
                while (count < reels) {
                    int next = grid[count][line[count]];
                    if (next == symbol) {
                        count++;
                    } else if (next == wild) {
                        wildUsed = true;
                        count++;
                    } else {
                        break;
                    }
                }
                int wildMultiplier = wildUsed ? rules.wildLineMultiplier() : 1;
                long value = math.linePay(symbol, count) * wildMultiplier;
                if (value > 0 && value >= bestValue) {
                    bestSymbol = symbol;
                    bestCount = count;
                    bestWildMultiplier = wildMultiplier;
                    bestValue = value;
                }
            }
        }
        if (bestSymbol == GameMath.NONE) {
            return null;
        }
        long amount = bestValue * freeSpinMultiplier * bet / (100L * lineCount);
        int[][] positions = new int[bestCount][];
        for (int reel = 0; reel < bestCount; reel++) {
            positions[reel] = new int[]{reel, line[reel]};
        }
        return new WinItem.Line(lineNumber, math.code(bestSymbol), bestCount, positions, amount, bestWildMultiplier,
                freeSpinMultiplier);
    }

    /** Dopisuje krok {@code win} (jeśli są wygrane) i zwraca kwotę faktycznie dodaną do rundy. */
    static long recordWins(RoundBuilder round, List<WinItem> wins) {
        if (wins.isEmpty()) {
            return 0;
        }
        long sum = wins.stream().mapToLong(WinItem::amount).sum();
        long added = round.addWin(sum);
        round.add(new RoundStep.Win(wins, added, round.totalWin()));
        return added;
    }

    /** NEON JACKPOT: wszystkie pola to jeden zwykły symbol albo WILD (także cała plansza WILD). */
    static boolean isFullScreen(GameMath math, int[][] grid) {
        int symbol = GameMath.NONE;
        for (int[] reel : grid) {
            for (int cell : reel) {
                if (cell == math.wild()) {
                    continue;
                }
                if (math.kind(cell) != SymbolKind.NORMAL || (symbol != GameMath.NONE && cell != symbol)) {
                    return false;
                }
                symbol = cell;
            }
        }
        return true;
    }

    /** Darmowe spiny S2: każdy bęben z WILD-em staje się w całości WILD. Zwraca numery rozszerzonych bębnów. */
    static List<Integer> expandWilds(GameMath math, int[][] grid) {
        List<Integer> expanded = new ArrayList<>();
        if (math.wild() == GameMath.NONE) {
            return expanded;
        }
        for (int reel = 0; reel < grid.length; reel++) {
            boolean hasWild = false;
            for (int cell : grid[reel]) {
                hasWild |= cell == math.wild();
            }
            if (hasWild) {
                Arrays.fill(grid[reel], math.wild());
                expanded.add(reel);
            }
        }
        return expanded;
    }

    private List<Integer> anticipation(GameMath math, int[][] grid, boolean free) {
        return switch (rules.anticipation()) {
            case NONE -> List.of();
            case SCATTERS -> {
                FreeSpinsRules freeSpins = rules.freeSpins();
                int needed = freeSpins == null ? 0 : (free ? freeSpins.retriggerCount() : freeSpins.triggerCount());
                yield Grids.scatterAnticipation(grid, math.scatter(), needed - 1);
            }
            case WILDS_ON_LINE -> wildsOnLineAnticipation(math, grid);
        };
    }

    /** S1: jeśli na jakiejś linii WILD stoi na wszystkich bębnach poza ostatnim, ostatni bęben zwalnia. */
    private static List<Integer> wildsOnLineAnticipation(GameMath math, int[][] grid) {
        int last = grid.length - 1;
        for (int[] line : math.paylines()) {
            boolean allWild = math.wild() != GameMath.NONE;
            for (int reel = 0; reel < last && allWild; reel++) {
                allWild = grid[reel][line[reel]] == math.wild();
            }
            if (allWild) {
                return List.of(last);
            }
        }
        return List.of();
    }
}
