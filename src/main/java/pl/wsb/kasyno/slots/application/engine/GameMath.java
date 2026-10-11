package pl.wsb.kasyno.slots.application.engine;

import pl.wsb.kasyno.slots.domain.EngineType;
import pl.wsb.kasyno.slots.domain.Paylines;
import pl.wsb.kasyno.slots.domain.Payouts;
import pl.wsb.kasyno.slots.domain.ReelStrips;
import pl.wsb.kasyno.slots.domain.SlotMachine;
import pl.wsb.kasyno.slots.domain.SlotSymbol;
import pl.wsb.kasyno.slots.domain.SymbolKind;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Matematyka jednej gry w postaci gotowej do liczenia: symbole jako liczby {@code 0..n-1}, wypłaty jako tablice,
 * taśmy bębnów jako tablice indeksów, wagi jako sumy narastające.
 *
 * <p>Po co osobna klasa zamiast czytać encje w trakcie spinu: konfiguracja z bazy ({@code slot_machine},
 * {@code slot_symbol}) jest tekstowa i wygodna do edycji, ale silnik liczy miliony rund w testach RTP. Zamieniamy
 * ją raz (przy pierwszym spinie gry, potem z pamięci podręcznej {@link GameMathProvider}) na tablice liczb,
 * przy okazji sprawdzając spójność danych (nieznany kod symbolu na taśmie, zła liczba linii, ułamek groszy
 * w wypłacie). Obiekt jest niemodyfikowalny, więc wiele wątków może go używać jednocześnie.
 *
 * <p>Wypłaty trzymamy w setnych częściach mnożnika ({@code 1.5 → 150}), żeby liczyć na liczbach całkowitych
 * ({@code long}) bez błędów zaokrągleń typowych dla {@code double}.
 */
public final class GameMath {

    /** Brak symbolu danego rodzaju (np. S1 nie ma scattera). */
    public static final int NONE = -1;

    private final String gameCode;
    private final EngineType engineType;
    private final int reels;
    private final int rows;
    private final String[] codes;
    private final SymbolKind[] kinds;
    private final Map<String, Integer> indexByCode;
    private final int wild;
    private final int scatter;
    private final int multiplier;
    /** [symbol][liczba symboli] → wypłata w setnych (wygrane liniowe: dokładnie tyle symboli). */
    private final long[][] exactPays;
    /** [symbol][liczba/rozmiar] → wypłata w setnych dla „co najmniej” (klastry, scatter). */
    private final long[][] atLeastPays;
    private final int[][] paylines;
    private final int[][] baseStrips;
    private final int[][] freeStrips;
    private final int[] baseCumulativeWeights;
    private final int[] freeCumulativeWeights;

    private GameMath(SlotMachine machine, List<SlotSymbol> symbols) {
        this.gameCode = machine.getCode();
        this.engineType = machine.getEngineType();
        this.reels = machine.getReels();
        this.rows = machine.getRows();
        int n = symbols.size();
        if (n == 0) {
            throw invalid("brak symboli w slot_symbol");
        }
        this.codes = new String[n];
        this.kinds = new SymbolKind[n];
        this.indexByCode = new HashMap<>();
        int wildIndex = NONE;
        int scatterIndex = NONE;
        int multiplierIndex = NONE;
        int maxCount = reels * rows;
        this.exactPays = new long[n][maxCount + 1];
        this.atLeastPays = new long[n][maxCount + 1];
        for (int i = 0; i < n; i++) {
            SlotSymbol symbol = symbols.get(i);
            codes[i] = symbol.getCode();
            kinds[i] = symbol.getKind();
            if (indexByCode.put(symbol.getCode(), i) != null) {
                throw invalid("symbol " + symbol.getCode() + " występuje dwa razy");
            }
            switch (symbol.getKind()) {
                case WILD -> wildIndex = single(wildIndex, i, "WILD");
                case SCATTER -> scatterIndex = single(scatterIndex, i, "SCATTER");
                case MULTIPLIER -> multiplierIndex = single(multiplierIndex, i, "MULTIPLIER");
                case NORMAL -> { }
            }
            Payouts pays = symbol.getPays();
            for (int count = 1; count <= maxCount; count++) {
                exactPays[i][count] = pays.forExactCount(count).map(this::toHundredths).orElse(0L);
                atLeastPays[i][count] = pays.forCluster(count).map(this::toHundredths).orElse(0L);
            }
        }
        this.wild = wildIndex;
        this.scatter = scatterIndex;
        this.multiplier = multiplierIndex;

        if (engineType == EngineType.LINES) {
            this.paylines = compilePaylines(machine.getPaylines(), machine.getLines());
            this.baseStrips = compileStrips(machine.getReelStrips(), "reel_strips");
            this.freeStrips = machine.getFreeReelStrips() == null
                    ? baseStrips : compileStrips(machine.getFreeReelStrips(), "free_reel_strips");
            this.baseCumulativeWeights = null;
            this.freeCumulativeWeights = null;
        } else {
            this.paylines = null;
            this.baseStrips = null;
            this.freeStrips = null;
            this.baseCumulativeWeights = cumulativeWeights(symbols, false);
            this.freeCumulativeWeights = cumulativeWeights(symbols, true);
        }
    }

    /**
     * Kompiluje konfigurację automatu i jego symbole (posortowane wg {@code sortOrder}).
     *
     * @throws IllegalStateException gdy dane w bazie są niespójne (opis problemu w komunikacie)
     */
    public static GameMath of(SlotMachine machine, List<SlotSymbol> symbols) {
        return new GameMath(machine, symbols);
    }

    private int single(int current, int index, String kind) {
        if (current != NONE) {
            throw invalid("gra może mieć tylko jeden symbol " + kind);
        }
        return index;
    }

    private long toHundredths(BigDecimal multiplier) {
        try {
            return multiplier.movePointRight(2).longValueExact();
        } catch (ArithmeticException e) {
            throw invalid("wypłata " + multiplier + " ma więcej niż 2 miejsca po przecinku");
        }
    }

    private int[][] compilePaylines(Paylines lines, Integer expectedCount) {
        if (lines == null || expectedCount == null || lines.count() != expectedCount) {
            throw invalid("kolumna paylines musi zawierać " + expectedCount + " linii");
        }
        int[][] result = new int[lines.count()][];
        for (int i = 0; i < lines.count(); i++) {
            List<Integer> line = lines.asList().get(i);
            if (line.size() != reels || line.stream().anyMatch(row -> row >= rows)) {
                throw invalid("linia " + (i + 1) + " nie pasuje do siatki " + reels + "×" + rows);
            }
            result[i] = line.stream().mapToInt(Integer::intValue).toArray();
        }
        return result;
    }

    private int[][] compileStrips(ReelStrips strips, String column) {
        if (strips == null || strips.reelCount() != reels) {
            throw invalid("kolumna " + column + " musi zawierać " + reels + " taśm");
        }
        int[][] result = new int[reels][];
        for (int reel = 0; reel < reels; reel++) {
            List<String> strip = strips.reel(reel);
            if (strip.size() < rows) {
                throw invalid("taśma bębna " + (reel + 1) + " jest krótsza niż liczba rzędów");
            }
            result[reel] = strip.stream().mapToInt(code -> {
                Integer index = indexByCode.get(code);
                if (index == null || kinds[index] == SymbolKind.MULTIPLIER) {
                    throw invalid("nieznany symbol „" + code + "” na taśmie bębna");
                }
                return index;
            }).toArray();
        }
        return result;
    }

    /** Sumy narastające wag; kula mnożnika wypada tylko w darmowych spinach ({@code free = true}). */
    private int[] cumulativeWeights(List<SlotSymbol> symbols, boolean free) {
        int[] cumulative = new int[symbols.size()];
        int total = 0;
        for (int i = 0; i < symbols.size(); i++) {
            boolean allowed = free || kinds[i] != SymbolKind.MULTIPLIER;
            total += allowed ? symbols.get(i).getWeight() : 0;
            cumulative[i] = total;
        }
        if (total <= 0) {
            throw invalid("suma wag symboli musi być dodatnia");
        }
        return cumulative;
    }

    private IllegalStateException invalid(String problem) {
        return new IllegalStateException("Błędna konfiguracja gry " + gameCode + ": " + problem);
    }

    /** Losuje symbol z wagami (gry klastrowe): {@code free} = rozkład darmowych spinów (z kulami mnożników). */
    int drawSymbol(RandomSource random, boolean free) {
        int[] cumulative = free ? freeCumulativeWeights : baseCumulativeWeights;
        int roll = random.nextInt(cumulative[cumulative.length - 1]);
        int index = 0;
        while (cumulative[index] <= roll) {
            index++;
        }
        return index;
    }

    public String gameCode() {
        return gameCode;
    }

    public int reels() {
        return reels;
    }

    public int rows() {
        return rows;
    }

    public int symbolCount() {
        return codes.length;
    }

    public String code(int symbol) {
        return codes[symbol];
    }

    public SymbolKind kind(int symbol) {
        return kinds[symbol];
    }

    /** Indeks symbolu o podanym kodzie (np. w testach konkretnych układów). */
    public Optional<Integer> indexOf(String code) {
        return Optional.ofNullable(indexByCode.get(code));
    }

    public int wild() {
        return wild;
    }

    public int scatter() {
        return scatter;
    }

    public int multiplier() {
        return multiplier;
    }

    /** Wypłata (w setnych mnożnika) za dokładnie {@code count} symboli na linii. */
    public long linePay(int symbol, int count) {
        return count < exactPays[symbol].length ? exactPays[symbol][count] : 0;
    }

    /** Wypłata (w setnych mnożnika) za co najmniej {@code count} symboli: klaster albo scatter. */
    public long atLeastPay(int symbol, int count) {
        long[] pays = atLeastPays[symbol];
        return pays[Math.min(count, pays.length - 1)];
    }

    int[][] paylines() {
        return paylines;
    }

    int[][] strips(boolean free) {
        return free ? freeStrips : baseStrips;
    }

    public int paylineCount() {
        return paylines == null ? 0 : paylines.length;
    }

    public int[][] stripsCopy(boolean free) {
        int[][] source = strips(free);
        int[][] copy = new int[source.length][];
        for (int i = 0; i < source.length; i++) {
            copy[i] = source[i].clone();
        }
        return copy;
    }
}
