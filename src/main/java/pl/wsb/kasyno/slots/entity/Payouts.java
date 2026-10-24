package pl.wsb.kasyno.slots.entity;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.SortedMap;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * Wypłaty symbolu: liczba symboli → mnożnik zakładu (obiekt wartości, niemodyfikowalny).
 *
 * <p>Ten sam kształt obsługuje oba rodzaje gier:
 * <ul>
 *   <li>linie: klucz to liczba symboli na linii, np. {@code 3:5,4:20,5:100} (3 symbole = 5× zakładu);</li>
 *   <li>klastry: klucz to rozmiar klastra, np. {@code 5:0.5,8:2,12:10,15:50}; klaster większy niż ostatni
 *       próg płaci jak najbliższy niższy próg (metoda {@link #forCluster}).</li>
 * </ul>
 * W bazie jedna kolumna tekstowa {@code pays}, zamieniana przez {@link PayoutsConverter}. W JSON
 * to obiekt {@code { "3": 5, "4": 20 }} (kontrakt API, § 2.2).
 */
public final class Payouts {

    private static final Payouts NONE = new Payouts(new TreeMap<>());

    private final SortedMap<Integer, BigDecimal> multipliers;

    private Payouts(SortedMap<Integer, BigDecimal> multipliers) {
        multipliers.forEach((count, multiplier) -> {
            if (count <= 0 || multiplier.signum() < 0) {
                throw new IllegalArgumentException("Niepoprawna wypłata " + count + ":" + multiplier);
            }
        });
        this.multipliers = Collections.unmodifiableSortedMap(multipliers);
    }

    /** Symbol bez wypłat (np. kula mnożnika). */
    public static Payouts none() {
        return NONE;
    }

    public static Payouts of(Map<Integer, BigDecimal> multipliers) {
        return new Payouts(new TreeMap<>(multipliers));
    }

    /** Odczyt z tekstu {@code "3:5,4:20,5:100"}; pusty tekst oznacza brak wypłat. */
    public static Payouts parse(String text) {
        if (text == null || text.isBlank()) {
            return NONE;
        }
        SortedMap<Integer, BigDecimal> parsed = new TreeMap<>();
        for (String entry : text.split(",")) {
            String[] parts = entry.split(":");
            if (parts.length != 2) {
                throw new IllegalArgumentException("Wpis wypłaty musi mieć postać liczba:mnożnik, a jest: " + entry);
            }
            parsed.put(Integer.parseInt(parts[0].strip()), new BigDecimal(parts[1].strip()));
        }
        return new Payouts(parsed);
    }

    /** Zapis do tekstu {@code "3:5,4:20,5:100"}. */
    public String toText() {
        return multipliers.entrySet().stream()
                .map(e -> e.getKey() + ":" + e.getValue().stripTrailingZeros().toPlainString())
                .collect(Collectors.joining(","));
    }

    /** Mnożnik dla dokładnie {@code count} symboli (gry liniowe). */
    public Optional<BigDecimal> forExactCount(int count) {
        return Optional.ofNullable(multipliers.get(count));
    }

    /** Mnożnik dla klastra o rozmiarze {@code size}: najwyższy próg nie większy niż rozmiar. */
    public Optional<BigDecimal> forCluster(int size) {
        SortedMap<Integer, BigDecimal> upToSize = multipliers.headMap(size + 1);
        return upToSize.isEmpty() ? Optional.empty() : Optional.of(upToSize.get(upToSize.lastKey()));
    }

    public Map<Integer, BigDecimal> asMap() {
        return multipliers;
    }

    public boolean isEmpty() {
        return multipliers.isEmpty();
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof Payouts that && toText().equals(that.toText());
    }

    @Override
    public int hashCode() {
        return Objects.hash(toText());
    }

    @Override
    public String toString() {
        return toText();
    }
}
