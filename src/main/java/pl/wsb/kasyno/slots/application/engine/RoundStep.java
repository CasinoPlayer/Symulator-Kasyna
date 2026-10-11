package pl.wsb.kasyno.slots.application.engine;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.annotation.JsonTypeName;

import java.util.List;

/**
 * Jeden krok animacji rundy: dokładnie format z kontraktu API ({@code docs/projekt/09}, § 2.4). Serwer liczy całą
 * rundę naraz, a przeglądarka odgrywa kroki po kolei, niczego nie losując ani nie licząc.
 *
 * <p>Każdy typ kroku to osobny rekord; Jackson dopisuje pole {@code "type"} (np. {@code "spin"}) na podstawie
 * {@link JsonTypeName}. Pola {@code null} są pomijane (np. {@code freeSpinIndex} w grze podstawowej, {@code orbs}
 * w grach liniowych). Siatka zawsze jako {@code grid[bęben][rząd]}, rząd 0 = górny; pozycja to {@code [bęben, rząd]}.
 * Kroki, które dodają wygraną, mają {@code win} (ile dodał) i {@code totalWin} (suma narastająca rundy).
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
@JsonSubTypes({
        @JsonSubTypes.Type(RoundStep.Spin.class),
        @JsonSubTypes.Type(RoundStep.ExpandWild.class),
        @JsonSubTypes.Type(RoundStep.Feature.class),
        @JsonSubTypes.Type(RoundStep.Win.class),
        @JsonSubTypes.Type(RoundStep.Cascade.class),
        @JsonSubTypes.Type(RoundStep.ApplyMultiplier.class),
        @JsonSubTypes.Type(RoundStep.FreeSpinsStart.class),
        @JsonSubTypes.Type(RoundStep.FreeSpinsRetrigger.class),
        @JsonSubTypes.Type(RoundStep.FreeSpinsEnd.class)
})
public sealed interface RoundStep {

    /** Nazwa funkcji S1 „NEON JACKPOT” w kroku {@link Feature}. */
    String NEON_JACKPOT = "neonJackpot";
    /** Nazwa kroku {@link Feature} oznaczającego osiągnięcie maksymalnej wygranej rundy (runda się kończy). */
    String MAX_WIN = "maxWin";

    /**
     * Obrót bębnów (S1, S2) albo zrzut planszy (S3).
     *
     * @param phase         {@code base} albo {@code free}
     * @param grid          siatka symboli po zatrzymaniu
     * @param anticipation  bębny do spowolnienia („prawie bonus”), może być pusta
     * @param freeSpinIndex numer darmowego spinu od 1 (tylko {@code free})
     * @param freeSpinsLeft ile darmowych spinów zostało po tym (tylko {@code free})
     * @param orbs          kule mnożników na planszy (tylko S3; w grze podstawowej pusta lista)
     */
    @JsonTypeName("spin")
    record Spin(String phase, String[][] grid, List<Integer> anticipation, Integer freeSpinIndex,
                Integer freeSpinsLeft, List<Orb> orbs) implements RoundStep {
    }

    /** S2: WILD rozszerza się na całe bębny {@code reels}; {@code grid} to siatka po rozszerzeniu. */
    @JsonTypeName("expandWild")
    record ExpandWild(List<Integer> reels, String[][] grid) implements RoundStep {
    }

    /**
     * Funkcja specjalna: {@code neonJackpot} (S1, cały ekran jednego symbolu: wygrana linii × {@code multiplier},
     * krok dodaje {@code win} = (mnożnik − 1) × wygrana linii) albo {@code maxWin} (osiągnięty limit wygranej rundy,
     * {@code multiplier} = limit jako wielokrotność zakładu, bez {@code win}).
     */
    @JsonTypeName("feature")
    record Feature(String name, int multiplier, Long win, Long totalWin) implements RoundStep {
    }

    /** Ocena wygranych po obrocie albo po kaskadzie. */
    @JsonTypeName("win")
    record Win(List<WinItem> wins, long win, long totalWin) implements RoundStep {
    }

    /**
     * S3: wygrane symbole pękają ({@code removed}), reszta opada, a od góry dochodzą {@code newSymbols}
     * (dla każdego bębna lista od góry). {@code grid} to siatka po opadzie, {@code orbs} to nowe kule mnożników
     * (pozycje po opadzie).
     */
    @JsonTypeName("cascade")
    record Cascade(int[][] removed, List<List<String>> newSymbols, String[][] grid, List<Orb> orbs)
            implements RoundStep {
    }

    /**
     * S3, darmowe spiny: koniec sekwencji kaskad, suma kul {@code orbsSum} mnoży wygraną sekwencji
     * {@code baseWin}; krok dodaje {@code win} = {@code baseWin} × ({@code orbsSum} − 1).
     */
    @JsonTypeName("applyMultiplier")
    record ApplyMultiplier(int orbsSum, long baseWin, long win, long totalWin) implements RoundStep {
    }

    /** Aktywacja {@code count} darmowych spinów przez scattery na pozycjach {@code trigger}. */
    @JsonTypeName("freeSpinsStart")
    record FreeSpinsStart(int count, int[][] trigger) implements RoundStep {
    }

    /** Dodatkowe darmowe spiny w trakcie darmowych spinów. */
    @JsonTypeName("freeSpinsRetrigger")
    record FreeSpinsRetrigger(int added, int[][] trigger, int freeSpinsLeft) implements RoundStep {
    }

    /** Koniec darmowych spinów; {@code freeSpinsWin} = suma wygranych z darmowych spinów. */
    @JsonTypeName("freeSpinsEnd")
    record FreeSpinsEnd(long freeSpinsWin) implements RoundStep {
    }

    /** Kula mnożnika S3 na pozycji {@code pos} = {@code [bęben, rząd]} o wartości {@code value} (×2 … ×100). */
    record Orb(int[] pos, int value) {
    }
}
