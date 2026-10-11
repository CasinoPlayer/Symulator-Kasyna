package pl.wsb.kasyno.slots.application.engine;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import pl.wsb.kasyno.slots.domain.SlotMachine;
import pl.wsb.kasyno.slots.domain.SlotMachineRepository;
import pl.wsb.kasyno.slots.domain.SlotSymbol;
import pl.wsb.kasyno.slots.domain.SlotSymbolRepository;
import pl.wsb.kasyno.slots.domain.SymbolKind;

import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Spójność matematyki gier zapisanej w {@code data.sql} (prawdziwa baza H2, {@code @DataJpaTest}): kody symboli
 * zgodne z briefem projektu, wagi zgodne z taśmami, wypłaty bez ułamków przy najmniejszym zakładzie, rozmieszczenie
 * WILD i scatterów na taśmach Złotego Faraona.
 */
@DataJpaTest(showSql = false)
@ActiveProfiles("test")
@Import(GameMathProvider.class)
@DisplayName("Matematyka gier w data.sql: spójność danych")
class SlotMathDataTest {

    @Autowired
    private SlotMachineRepository machines;
    @Autowired
    private SlotSymbolRepository symbols;
    @Autowired
    private GameMathProvider mathProvider;

    private SlotMachine machine(String code) {
        return machines.findByCodeAndActiveTrue(code).orElseThrow();
    }

    private List<SlotSymbol> symbolsOf(String code) {
        return symbols.findBySlotMachineIdOrderBySortOrderAsc(machine(code).getId());
    }

    @Test
    @DisplayName("kody symboli dokładnie jak w briefie (od najniższego), z właściwymi rodzajami")
    void symbolCodesMatchBrief() {
        assertThat(symbolsOf(SlotEnginesConfig.CEBULOWY_777)).extracting(SlotSymbol::getCode)
                .containsExactly("wisnie", "cytryna", "sliwka", "arbuz", "dzwonek", "bar", "siodemka", "wild");
        assertThat(symbolsOf(SlotEnginesConfig.ZLOTY_FARAON)).extracting(SlotSymbol::getCode)
                .containsExactly("10", "j", "q", "k", "a", "ankh", "oko", "skarabeusz", "anubis", "faraon",
                        "wild", "scatter");
        assertThat(symbolsOf(SlotEnginesConfig.KRYSZTALOWA_KASKADA)).extracting(SlotSymbol::getCode)
                .containsExactly("szafir", "szmaragd", "ametyst", "topaz", "rubin", "diament", "cebula",
                        "scatter", "mnoznik");
        assertThat(symbolsOf(SlotEnginesConfig.KRYSZTALOWA_KASKADA).getLast().getKind())
                .isEqualTo(SymbolKind.MULTIPLIER);
        assertThat(symbolsOf(SlotEnginesConfig.ZLOTY_FARAON)).filteredOn(s -> s.getKind() == SymbolKind.SCATTER)
                .extracting(SlotSymbol::getCode).containsExactly("scatter");
    }

    @Test
    @DisplayName("S1: linie dokładnie jak w kontrakcie API (§ 2.2)")
    void cebulowyPaylinesMatchContract() {
        assertThat(machine(SlotEnginesConfig.CEBULOWY_777).getPaylines().asList()).containsExactly(
                List.of(1, 1, 1), List.of(0, 0, 0), List.of(2, 2, 2), List.of(0, 1, 2), List.of(2, 1, 0));
        assertThat(machine(SlotEnginesConfig.ZLOTY_FARAON).getPaylines().count()).isEqualTo(20);
        assertThat(machine(SlotEnginesConfig.ZLOTY_FARAON).getPaylines().asList()).doesNotHaveDuplicates();
    }

    @Test
    @DisplayName("gry liniowe: waga symbolu = liczba wystąpień na taśmach gry podstawowej")
    void linesWeightsMatchStrips() {
        for (String code : List.of(SlotEnginesConfig.CEBULOWY_777, SlotEnginesConfig.ZLOTY_FARAON)) {
            GameMath math = mathProvider.mathFor(machine(code));
            for (SlotSymbol symbol : symbolsOf(code)) {
                int index = math.indexOf(symbol.getCode()).orElseThrow();
                long onStrips = 0;
                for (int[] strip : math.strips(false)) {
                    onStrips += IntStream.of(strip).filter(s -> s == index).count();
                }
                assertThat(onStrips).as("%s/%s", code, symbol.getCode()).isEqualTo(symbol.getWeight());
            }
        }
    }

    /**
     * Kontrakt mówi „ułamki zaokrąglamy w dół”, ale wypłaty dobraliśmy tak, żeby przy najmniejszym zakładzie (a więc
     * przy każdym, bo poziomy są jego wielokrotnościami) zaokrąglenie nigdy nie było potrzebne: RTP nie zależy od
     * wysokości zakładu.
     */
    @Test
    @DisplayName("każda wypłata przy najmniejszym zakładzie jest całkowita (RTP nie zależy od zakładu)")
    void paysAreWholeAtMinimumBet() {
        for (SlotMachine machine : machines.findByActiveTrueOrderByIdAsc()) {
            GameMath math = mathProvider.mathFor(machine);
            long minBet = machine.getMinBet().longValueExact();
            assertThat(machine.getBetLevels().asList())
                    .allSatisfy(level -> assertThat(level.longValueExact() % minBet).isZero());
            for (int symbol = 0; symbol < math.symbolCount(); symbol++) {
                for (int count = 1; count <= math.reels() * math.rows(); count++) {
                    if (math.paylineCount() > 0 && math.kind(symbol) != SymbolKind.SCATTER) {
                        // linia: mnożnik × zakład / liczba linii (× 2 za WILD lub darmowe spiny też całkowite)
                        assertThat(math.linePay(symbol, count) * minBet % (100L * math.paylineCount()))
                                .as("%s %s×%d", machine.getCode(), math.code(symbol), count).isZero();
                    } else {
                        assertThat(math.atLeastPay(symbol, count) * minBet % 100)
                                .as("%s %s×%d", machine.getCode(), math.code(symbol), count).isZero();
                    }
                }
            }
        }
    }

    @Test
    @DisplayName("S2: WILD tylko na bębnach 2–4, scattery na taśmie co najmniej 3 pozycje od siebie (max 1 w oknie)")
    void faraonStripLayout() {
        GameMath math = mathProvider.mathFor(machine(SlotEnginesConfig.ZLOTY_FARAON));
        for (boolean free : new boolean[]{false, true}) {
            int[][] strips = math.strips(free);
            for (int reel = 0; reel < strips.length; reel++) {
                int[] strip = strips[reel];
                boolean hasWild = IntStream.of(strip).anyMatch(s -> s == math.wild());
                assertThat(hasWild).as("WILD na bębnie %d", reel + 1).isEqualTo(reel >= 1 && reel <= 3);
                for (int position = 0; position < strip.length; position++) {
                    if (strip[position] == math.scatter()) {
                        assertThat(strip[(position + 1) % strip.length]).isNotEqualTo(math.scatter());
                        assertThat(strip[(position + 2) % strip.length]).isNotEqualTo(math.scatter());
                    }
                }
            }
        }
    }
}
