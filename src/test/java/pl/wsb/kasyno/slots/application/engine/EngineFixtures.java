package pl.wsb.kasyno.slots.application.engine;

import pl.wsb.kasyno.slots.entity.BetLevels;
import pl.wsb.kasyno.slots.entity.EngineType;
import pl.wsb.kasyno.slots.entity.Paylines;
import pl.wsb.kasyno.slots.entity.Payouts;
import pl.wsb.kasyno.slots.entity.ReelStrips;
import pl.wsb.kasyno.slots.entity.SlotMachine;
import pl.wsb.kasyno.slots.entity.SlotSymbol;
import pl.wsb.kasyno.slots.entity.SymbolKind;
import pl.wsb.kasyno.slots.entity.Volatility;

import java.math.BigDecimal;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Deque;
import java.util.List;

/**
 * Narzędzia testów silników: małe, ręcznie zbudowane gry (zamiast danych z {@code data.sql}) i „ustawione” źródło
 * liczb losowych, dzięki którym test wybiera dokładny układ symboli i sprawdza wynik co do kroku.
 */
final class EngineFixtures {

    private EngineFixtures() {
    }

    /** Symbol testowej gry w zapisie {@code "kod RODZAJ waga wypłaty"}, np. {@code "x NORMAL 1 3:5"}. */
    static List<SlotSymbol> symbols(SlotMachine machine, String... specs) {
        List<SlotSymbol> symbols = new ArrayList<>();
        for (int i = 0; i < specs.length; i++) {
            String[] parts = specs[i].split(" ");
            symbols.add(new SlotSymbol(machine, parts[0], SymbolKind.valueOf(parts[1]), Integer.parseInt(parts[2]),
                    parts.length > 3 ? Payouts.parse(parts[3]) : Payouts.none(), i + 1));
        }
        return symbols;
    }

    /**
     * Gra liniowa, w której taśma każdego bębna to sklejone „okna” po {@code rows} symboli: pozycja zatrzymania
     * {@code k × rows} pokazuje k-te okno. Okna podajemy jako kolumny {@code "góra,środek,dół"}.
     *
     * @param windows {@code windows[k][bęben]} = kolumna widoczna w k-tym oknie
     */
    static SlotMachine linesMachine(int reels, int rows, String paylines, String[][] windows) {
        int lineCount = Paylines.parse(paylines).count();
        SlotMachine machine = new SlotMachine("test-lines", "Test", EngineType.LINES, reels, rows, lineCount,
                BetLevels.parse("10,30,50"), new BigDecimal("95"), Volatility.LOW_MEDIUM, null);
        List<List<String>> strips = new ArrayList<>();
        for (int reel = 0; reel < reels; reel++) {
            List<String> strip = new ArrayList<>();
            for (String[] window : windows) {
                strip.addAll(Arrays.asList(window[reel].split(",")));
            }
            strips.add(strip);
        }
        machine.defineReels(ReelStrips.of(strips), null, Paylines.parse(paylines));
        return machine;
    }

    static SlotMachine clusterMachine() {
        return new SlotMachine("test-cluster", "Test", EngineType.CLUSTER, 6, 5, null,
                BetLevels.parse("20,40"), new BigDecimal("96"), Volatility.HIGH, null);
    }

    /** Siatka z kolumn {@code "góra,środek,dół"} (kody symboli), np. {@code grid(math, "x,w,x", "y,y,y", "z,z,z")}. */
    static int[][] grid(GameMath math, String... columns) {
        int[][] grid = new int[columns.length][];
        for (int reel = 0; reel < columns.length; reel++) {
            grid[reel] = Arrays.stream(columns[reel].split(","))
                    .mapToInt(code -> math.indexOf(code).orElseThrow(() -> new IllegalArgumentException(code)))
                    .toArray();
        }
        return grid;
    }

    /**
     * Źródło „losowe” zwracające zaplanowane liczby; po ich wyczerpaniu zwraca {@code fallback} albo kolejne
     * wartości cyklu {@code cycleFrom, cycleFrom+1, …, cycleFrom+cycleLength-1} (zob. {@link #cycling}).
     */
    static final class ScriptedRandom implements RandomSource {

        private final Deque<Integer> planned = new ArrayDeque<>();
        private final int cycleFrom;
        private final int cycleLength;
        private int calls;

        private ScriptedRandom(int cycleFrom, int cycleLength) {
            this.cycleFrom = cycleFrom;
            this.cycleLength = cycleLength;
        }

        /** Po wyczerpaniu planu zawsze zwraca {@code fallback}. */
        static ScriptedRandom constant(int fallback) {
            return new ScriptedRandom(fallback, 1);
        }

        /**
         * Po wyczerpaniu planu zwraca kolejno {@code from, from+1, …} w cyklu długości {@code length}. Dla gry
         * klastrowej z wagami 1 i symbolami 1..6 daje to planszę bez dwóch takich samych sąsiadów (pola losowane
         * kolumnami: sąsiad w pionie to następna liczba, w poziomie liczba o 5 dalej, a 5 nie dzieli się przez 6).
         */
        static ScriptedRandom cycling(int from, int length) {
            return new ScriptedRandom(from, length);
        }

        ScriptedRandom then(int... values) {
            for (int value : values) {
                planned.add(value);
            }
            return this;
        }

        @Override
        public int nextInt(int bound) {
            int value = planned.isEmpty() ? cycleFrom + (calls % cycleLength) : planned.poll();
            calls++;
            if (value < 0 || value >= bound) {
                throw new IllegalStateException("Zaplanowana liczba " + value + " spoza [0, " + bound + ")");
            }
            return value;
        }

        boolean exhausted() {
            return planned.isEmpty();
        }
    }
}
