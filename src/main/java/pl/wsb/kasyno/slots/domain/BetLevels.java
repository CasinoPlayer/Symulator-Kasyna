package pl.wsb.kasyno.slots.domain;

import pl.wsb.kasyno.shared.domain.Money;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Dozwolone zakłady automatu, np. {@code 10, 20, 50, 100, 200, 500, 1000} (obiekt wartości, niemodyfikowalny).
 *
 * <p>W bazie to jedna kolumna tekstowa {@code bet_levels = '10,20,50,100,200,500,1000'}, zamieniana na ten obiekt
 * przez {@link BetLevelsConverter}. Dlaczego nie {@code @ElementCollection} (osobna tabela):
 * <ul>
 *   <li>poziomy zakładu to część konfiguracji automatu: zawsze czytamy je razem z automatem i nigdy nie szukamy
 *       automatów „po jednym poziomie”, więc osobna tabela nic nie daje;</li>
 *   <li>osobna tabela to dodatkowe zapytanie lub złączenie przy każdym odczycie automatu (ryzyko N+1 na liście gier)
 *       i siódma tabela w schemacie, która nie jest „naszą” encją;</li>
 *   <li>lista ma kilka pozycji i zmienia się tylko razem z konfiguracją gry.</li>
 * </ul>
 */
public final class BetLevels {

    private final List<BigDecimal> levels;

    private BetLevels(List<BigDecimal> levels) {
        if (levels.isEmpty()) {
            throw new IllegalArgumentException("Automat musi mieć co najmniej jeden poziom zakładu");
        }
        if (levels.stream().anyMatch(level -> !Money.isPositive(level))) {
            throw new IllegalArgumentException("Poziomy zakładu muszą być dodatnie: " + levels);
        }
        this.levels = levels.stream().map(Money::normalize).sorted().distinct().toList();
    }

    public static BetLevels of(List<BigDecimal> levels) {
        return new BetLevels(List.copyOf(levels));
    }

    /** Odczyt z tekstu {@code "10,20,50"} (spacje dookoła liczb są ignorowane). */
    public static BetLevels parse(String csv) {
        if (csv == null || csv.isBlank()) {
            throw new IllegalArgumentException("Brak poziomów zakładu");
        }
        return of(Arrays.stream(csv.split(","))
                .map(String::strip)
                .map(BigDecimal::new)
                .toList());
    }

    /** Zapis do tekstu {@code "10,20,50"} (bez zbędnych zer po przecinku). */
    public String toCsv() {
        return levels.stream()
                .map(level -> level.stripTrailingZeros().toPlainString())
                .collect(Collectors.joining(","));
    }

    /** Czy zakład jest na liście (porównanie przez {@code compareTo}, więc {@code 100} = {@code 100.00}). */
    public boolean contains(BigDecimal bet) {
        return bet != null && levels.stream().anyMatch(level -> level.compareTo(bet) == 0);
    }

    public BigDecimal min() {
        return levels.getFirst();
    }

    public BigDecimal max() {
        return levels.getLast();
    }

    public List<BigDecimal> asList() {
        return levels;
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof BetLevels that && levels.equals(that.levels);
    }

    @Override
    public int hashCode() {
        return Objects.hash(levels);
    }

    @Override
    public String toString() {
        return toCsv();
    }
}
