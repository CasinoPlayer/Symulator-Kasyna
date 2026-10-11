package pl.wsb.kasyno.slots.application.engine;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.annotation.JsonTypeName;

/**
 * Pojedyncza wygrana w kroku {@link RoundStep.Win} (kontrakt API § 2.4, pole {@code kind}).
 *
 * <p>Jak liczymy kwoty (zawsze liczby całkowite, ułamki w dół):
 * <ul>
 *   <li>linia: mnożnik z tabeli × (zakład / liczba linii) × {@code wildMultiplier} × {@code freeSpinMultiplier};</li>
 *   <li>scatter i klaster: mnożnik z tabeli × zakład całkowity.</li>
 * </ul>
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "kind")
@JsonSubTypes({
        @JsonSubTypes.Type(WinItem.Line.class),
        @JsonSubTypes.Type(WinItem.Scatter.class),
        @JsonSubTypes.Type(WinItem.Cluster.class)
})
public sealed interface WinItem {

    /** Kwota tej wygranej w cebulionach. */
    long amount();

    /**
     * Wygrana na linii.
     *
     * @param line               numer linii od 1 (indeks w {@code paylines} + 1)
     * @param symbol             kod symbolu, który płaci (WILD zastępuje inne symbole)
     * @param count              ile kolejnych symboli od lewej
     * @param positions          pozycje wygrywających symboli
     * @param wildMultiplier     1 albo 2 (S1 „neonowy mnożnik”: WILD na wygrywającej linii)
     * @param freeSpinMultiplier 1 albo 2 (S2: wygrane w darmowych spinach)
     */
    @JsonTypeName("line")
    record Line(int line, String symbol, int count, int[][] positions, long amount, int wildMultiplier,
                int freeSpinMultiplier) implements WinItem {
    }

    /** Wygrana za scattery w dowolnym miejscu planszy. */
    @JsonTypeName("scatter")
    record Scatter(String symbol, int count, int[][] positions, long amount) implements WinItem {
    }

    /** Wygrana klastrowa S3: {@code size} takich samych symboli połączonych bokami. */
    @JsonTypeName("cluster")
    record Cluster(String symbol, int size, int[][] positions, long amount) implements WinItem {
    }
}
