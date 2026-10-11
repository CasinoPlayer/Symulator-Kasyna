package pl.wsb.kasyno.slots.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("Obiekty wartości automatów: poziomy zakładu, wypłaty, poziomy wygranej")
class SlotValueObjectsTest {

    @Test
    @DisplayName("BetLevels: odczyt z tekstu, sortowanie, min/max, porównanie bez względu na skalę")
    void betLevels() {
        BetLevels levels = BetLevels.parse(" 100, 10,20 ,50");

        assertThat(levels.toCsv()).isEqualTo("10,20,50,100");
        assertThat(levels.min()).isEqualByComparingTo("10");
        assertThat(levels.max()).isEqualByComparingTo("100");
        assertThat(levels.contains(new BigDecimal("50"))).isTrue();
        assertThat(levels.contains(new BigDecimal("50.00"))).isTrue();
        assertThat(levels.contains(new BigDecimal("7"))).isFalse();
        assertThat(levels.contains(null)).isFalse();
    }

    @Test
    @org.junit.jupiter.api.Timeout(2)
    @DisplayName("BET_INVALID: komunikat bezpieczny także dla absurdalnego zakładu z żądania (1e999999999)")
    void invalidBetMessageIsSafeForAbsurdBet() {
        BetLevels levels = BetLevels.parse("10,20");

        assertThat(new InvalidBetException(new BigDecimal("7"), levels).getMessage())
                .isEqualTo("Zakład 7 jest niedozwolony. Dozwolone: 10,20.");
        assertThat(new InvalidBetException(new BigDecimal("1e999999999"), levels).getMessage())
                .isEqualTo("Zakład 1E+999999999 jest niedozwolony. Dozwolone: 10,20.");
    }

    @Test
    @DisplayName("BetLevels: puste albo ujemne poziomy są odrzucane")
    void betLevelsValidation() {
        assertThatThrownBy(() -> BetLevels.parse("")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> BetLevels.parse("10,-5")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("konwerter JPA BetLevels: tekst ↔ obiekt bez strat")
    void betLevelsConverterRoundTrip() {
        BetLevelsConverter converter = new BetLevelsConverter();
        BetLevels levels = BetLevels.parse("10,20,50,100,200,500,1000");

        String column = converter.convertToDatabaseColumn(levels);

        assertThat(column).isEqualTo("10,20,50,100,200,500,1000");
        assertThat(converter.convertToEntityAttribute(column)).isEqualTo(levels);
    }

    @Test
    @DisplayName("Payouts: linie (dokładna liczba symboli) i klastry (najbliższy niższy próg)")
    void payouts() {
        Payouts lines = Payouts.parse("3:5,4:20,5:100");
        assertThat(lines.forExactCount(4)).contains(new BigDecimal("20"));
        assertThat(lines.forExactCount(2)).isEmpty();

        Payouts clusters = Payouts.parse("5:0.5,8:2,12:10");
        assertThat(clusters.forCluster(4)).isEmpty();
        assertThat(clusters.forCluster(5)).contains(new BigDecimal("0.5"));
        assertThat(clusters.forCluster(11)).contains(new BigDecimal("2"));
        assertThat(clusters.forCluster(30)).contains(new BigDecimal("10"));
    }

    @Test
    @DisplayName("konwerter JPA Payouts: tekst ↔ obiekt, pusty tekst = brak wypłat")
    void payoutsConverter() {
        PayoutsConverter converter = new PayoutsConverter();

        Payouts payouts = converter.convertToEntityAttribute("5:100, 3:5,4:20");

        assertThat(converter.convertToDatabaseColumn(payouts)).isEqualTo("3:5,4:20,5:100");
        assertThat(payouts.asMap()).containsOnlyKeys(3, 4, 5);
        assertThat(converter.convertToEntityAttribute(null).isEmpty()).isTrue();
        assertThatThrownBy(() -> Payouts.parse("3=5")).isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest(name = "wygrana {0} przy zakładzie {1} → {2}")
    @CsvSource({
            "0, 10, NONE", "1, 10, SMALL", "49, 10, SMALL", "50, 10, MEDIUM", "149, 10, MEDIUM", "150, 10, BIG",
            "300, 10, MEGA", "599, 10, MEGA", "600, 10, EPIC", "999, 10, EPIC", "1000, 10, ULTRA", "5000, 20, ULTRA"})
    @DisplayName("WinTier: progi 5×, 15×, 30×, 60×, 100× zakładu")
    void winTiers(BigDecimal win, BigDecimal bet, WinTier expected) {
        assertThat(WinTier.of(win, bet)).isEqualTo(expected);
    }

    @Test
    @DisplayName("WinTier: identyfikator dla frontu małymi literami")
    void winTierCode() {
        assertThat(WinTier.MEGA.code()).isEqualTo("mega");
        assertThat(WinTier.NONE.code()).isEqualTo("none");
    }

    @Test
    @DisplayName("SlotMachine: gra klastrowa nie ma linii, min/max z poziomów zakładu")
    void slotMachineDerivedFields() {
        SlotMachine machine = new SlotMachine("krysztalowa-kaskada", "Kryształowa Kaskada", EngineType.CLUSTER, 6, 5, 99,
                BetLevels.parse("20,40,2000"), new BigDecimal("96.00"), Volatility.HIGH, "A| B |");

        assertThat(machine.getLines()).isNull();
        assertThat(machine.getMinBet()).isEqualByComparingTo("20");
        assertThat(machine.getMaxBet()).isEqualByComparingTo("2000");
        assertThat(machine.getFeatureList()).containsExactly("A", "B");
        assertThatThrownBy(() -> new SlotMachine("x", "X", EngineType.LINES, 3, 3, null, BetLevels.parse("10"),
                BigDecimal.TEN, Volatility.HIGH, null)).isInstanceOf(IllegalArgumentException.class);
    }
}
