package pl.wsb.kasyno.slots.domain;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Taśmy bębnów automatu liniowego (obiekt wartości, niemodyfikowalny): dla każdego bębna lista kodów symboli
 * w kolejności, w jakiej są nadrukowane na taśmie. Taśma jest „pętlą”: po ostatnim symbolu wraca pierwszy.
 *
 * <p>Jak działa losowanie: silnik losuje dla każdego bębna pozycję zatrzymania {@code 0..długość-1}, a w oknie
 * automatu widać kolejne {@code rows} symbole od tej pozycji. Częstość symbolu = ile razy jest na taśmie
 * / długość taśmy, więc taśmy (a nie same wagi) decydują o matematyce gry i o tym, które symbole sąsiadują.
 *
 * <p>Zapis w bazie: jedna kolumna tekstowa (konwerter {@link ReelStripsConverter}), bębny rozdzielone {@code |},
 * symbole przecinkami, np. {@code "wisnie,bar,wild|cytryna,...|..."}. Dlaczego kolumna w {@code slot_machine},
 * a nie osobna tabela {@code reel_stop(automat, bęben, pozycja, symbol)}:
 * <ul>
 *   <li>taśmy czytamy zawsze w całości i razem z automatem (silnik potrzebuje wszystkich naraz), nigdy nie szukamy
 *       „pozycji 17 bębna 3”, więc tabela nic nie daje, a kosztuje ~550 wierszy i sortowanie po pozycji;</li>
 *   <li>kolejność symboli jest częścią danych: w kolumnie tekstowej jest zachowana wprost, w tabeli trzeba by
 *       pilnować kolumny {@code pozycja} i {@code ORDER BY};</li>
 *   <li>ta sama decyzja co dla {@link BetLevels}: brak siódmej tabeli bez własnej logiki i brak zapytań N+1;</li>
 *   <li>cała konfiguracja gry jest w {@code data.sql} w jednym miejscu, łatwa do porównania z dokumentacją.</li>
 * </ul>
 * Kody symboli muszą istnieć w {@code slot_symbol} tej gry; sprawdza to silnik przy wczytaniu konfiguracji.
 */
public final class ReelStrips {

    private final List<List<String>> reels;

    private ReelStrips(List<List<String>> reels) {
        if (reels.isEmpty() || reels.stream().anyMatch(List::isEmpty)) {
            throw new IllegalArgumentException("Każdy bęben musi mieć co najmniej jeden symbol");
        }
        this.reels = reels.stream().map(List::copyOf).toList();
    }

    public static ReelStrips of(List<List<String>> reels) {
        return new ReelStrips(reels);
    }

    /** Odczyt z tekstu {@code "a,b,c|d,e,f"} (spacje i znaki nowej linii dookoła kodów są ignorowane). */
    public static ReelStrips parse(String text) {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("Brak taśm bębnów");
        }
        return new ReelStrips(Arrays.stream(text.split("\\|"))
                .map(reel -> Arrays.stream(reel.split(",")).map(String::strip).filter(s -> !s.isEmpty()).toList())
                .toList());
    }

    /** Zapis do tekstu {@code "a,b,c|d,e,f"}. */
    public String toText() {
        return reels.stream().map(reel -> String.join(",", reel)).collect(Collectors.joining("|"));
    }

    public int reelCount() {
        return reels.size();
    }

    public List<String> reel(int index) {
        return reels.get(index);
    }

    public List<List<String>> asList() {
        return reels;
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof ReelStrips that && reels.equals(that.reels);
    }

    @Override
    public int hashCode() {
        return Objects.hash(reels);
    }

    @Override
    public String toString() {
        return toText();
    }
}
