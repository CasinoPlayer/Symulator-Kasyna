package pl.wsb.kasyno.slots.domain;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Linie wygrywające automatu liniowego (obiekt wartości, niemodyfikowalny). Każda linia to lista indeksów rzędów
 * (0 = górny) dla kolejnych bębnów, np. środkowa linia 3 bębnów to {@code [1,1,1]}, skośna {@code [0,1,2]}.
 * Numer linii w wygranych = indeks na liście + 1 (kontrakt API § 2.2).
 *
 * <p>Zapis w bazie: kolumna tekstowa (konwerter {@link PaylinesConverter}), linie rozdzielone {@code |}, rzędy
 * przecinkami: {@code "1,1,1|0,0,0|2,2,2|0,1,2|2,1,0"}. Uzasadnienie kolumny zamiast tabeli jak w
 * {@link ReelStrips}: linie zawsze czytamy w całości razem z automatem, a ich kolejność ma znaczenie (numer linii).
 */
public final class Paylines {

    private final List<List<Integer>> lines;

    private Paylines(List<List<Integer>> lines) {
        if (lines.isEmpty()) {
            throw new IllegalArgumentException("Automat liniowy musi mieć co najmniej jedną linię");
        }
        int length = lines.getFirst().size();
        for (List<Integer> line : lines) {
            if (line.size() != length || line.stream().anyMatch(row -> row < 0)) {
                throw new IllegalArgumentException("Linie muszą mieć tę samą długość i nieujemne rzędy: " + lines);
            }
        }
        this.lines = lines.stream().map(List::copyOf).toList();
    }

    public static Paylines of(List<List<Integer>> lines) {
        return new Paylines(lines);
    }

    /** Odczyt z tekstu {@code "1,1,1|0,0,0"}. */
    public static Paylines parse(String text) {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("Brak linii wygrywających");
        }
        return new Paylines(Arrays.stream(text.split("\\|"))
                .map(line -> Arrays.stream(line.split(",")).map(String::strip).map(Integer::valueOf).toList())
                .toList());
    }

    /** Zapis do tekstu {@code "1,1,1|0,0,0"}. */
    public String toText() {
        return lines.stream()
                .map(line -> line.stream().map(String::valueOf).collect(Collectors.joining(",")))
                .collect(Collectors.joining("|"));
    }

    public int count() {
        return lines.size();
    }

    public List<List<Integer>> asList() {
        return lines;
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof Paylines that && lines.equals(that.lines);
    }

    @Override
    public int hashCode() {
        return Objects.hash(lines);
    }

    @Override
    public String toString() {
        return toText();
    }
}
