package pl.wsb.kasyno.slots.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import pl.wsb.kasyno.support.TestData;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("ReelStrips i Paylines: zapis tekstowy taśm i linii")
class ReelStripsAndPaylinesTest {

    @Test
    @DisplayName("taśmy: tekst ↔ obiekt (spacje i nowe linie ignorowane), kolejność symboli zachowana")
    void reelStripsRoundTrip() {
        ReelStrips strips = ReelStrips.parse(" wisnie, bar ,wild |\n cytryna,siodemka ");

        assertThat(strips.reelCount()).isEqualTo(2);
        assertThat(strips.reel(0)).containsExactly("wisnie", "bar", "wild");
        assertThat(strips.toText()).isEqualTo("wisnie,bar,wild|cytryna,siodemka");
        assertThat(new ReelStripsConverter().convertToEntityAttribute(strips.toText())).isEqualTo(strips);
        assertThat(new ReelStripsConverter().convertToEntityAttribute(null)).isNull();
        assertThatThrownBy(() -> ReelStrips.parse("a,b||c")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("linie: tekst ↔ obiekt, wszystkie linie tej samej długości")
    void paylinesRoundTrip() {
        Paylines lines = Paylines.parse("1,1,1|0,1,2");

        assertThat(lines.asList()).containsExactly(List.of(1, 1, 1), List.of(0, 1, 2));
        assertThat(lines.toText()).isEqualTo("1,1,1|0,1,2");
        assertThat(new PaylinesConverter().convertToEntityAttribute("")).isNull();
        assertThatThrownBy(() -> Paylines.parse("1,1,1|0,1")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("automat liniowy: liczba taśm = liczba bębnów, liczba linii = line_count; klastrowy nie ma taśm")
    void machineValidatesReels() {
        SlotMachine machine = TestData.cebulowy777();

        assertThatThrownBy(() -> machine.defineReels(ReelStrips.parse("a|b"), null, Paylines.parse("1,1,1")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> machine.defineReels(ReelStrips.parse("a|b|c"), null, Paylines.parse("1,1,1")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> TestData.kaskada().defineReels(ReelStrips.parse("a|b|c|d|e|f"), null,
                Paylines.parse("1,1,1,1,1,1"))).isInstanceOf(IllegalStateException.class);
    }
}
