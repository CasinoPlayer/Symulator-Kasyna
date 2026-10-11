package pl.wsb.kasyno.wallet.api;

import java.math.BigDecimal;

/**
 * Port: „jaki jest najmniejszy zakład w kasynie?”. Portfel potrzebuje tej liczby do reguły bonusu ratunkowego
 * (saldo poniżej najmniejszego zakładu = bankrut), ale nie może pytać modułu {@code slots} bezpośrednio, bo to
 * {@code slots} zależy od portfela (pobiera zakłady). Interfejs leży więc w portfelu, a implementuje go
 * {@code slots} ({@code SlotCatalogService}); Spring łączy jedno z drugim przy starcie.
 */
public interface MinimumBetProvider {

    /** Najmniejszy zakład spośród aktywnych gier (0, gdy nie ma żadnej aktywnej gry). */
    BigDecimal minimumBet();
}
