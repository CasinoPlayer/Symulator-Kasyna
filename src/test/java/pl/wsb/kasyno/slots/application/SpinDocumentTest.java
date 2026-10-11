package pl.wsb.kasyno.slots.application;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import pl.wsb.kasyno.shared.domain.Money;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("SpinDocument: odpowiedź spinu w kształcie kontraktu § 2.4")
class SpinDocumentTest {

    @Test
    @DisplayName("pola w kolejności kontraktu, kwoty całkowite, mnożnik z ułamkiem, seed jako 16 cyfr hex")
    void composesContractShape() {
        String json = SpinDocument.compose(1042L, "zloty-faraon", Money.of(100), Money.of(2_350), Money.of(10_000),
                Money.of(12_250), 0x5f3a9c0e7b21d4a8L, "{\"steps\":[{\"type\":\"spin\"}]}");

        assertThat(json).isEqualTo("{\"roundId\":1042,\"gameCode\":\"zloty-faraon\",\"bet\":100,\"totalWin\":2350,"
                + "\"multiplier\":23.5,\"tier\":\"big\",\"balanceBefore\":10000,\"balanceAfter\":12250,"
                + "\"seed\":\"5f3a9c0e7b21d4a8\",\"steps\":[{\"type\":\"spin\"}]}");
    }

    @Test
    @DisplayName("ziarno ujemne (najwyższy bit) i małe: zawsze 16 znaków; brak wygranej → tier none, mnożnik 0")
    void seedAndZeroWin() {
        assertThat(SpinDocument.seedHex(-1L)).isEqualTo("ffffffffffffffff");
        assertThat(SpinDocument.seedHex(42L)).isEqualTo("000000000000002a");

        String json = SpinDocument.compose(1L, "cebulowy-777", Money.of(10), Money.of(0), Money.of(10),
                Money.of(0), 42L, "{\"steps\":[]}");
        assertThat(json).contains("\"totalWin\":0,\"multiplier\":0,\"tier\":\"none\"");
    }
}
