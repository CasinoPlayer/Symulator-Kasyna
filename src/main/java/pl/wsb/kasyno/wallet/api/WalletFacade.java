package pl.wsb.kasyno.wallet.api;

import java.math.BigDecimal;
import java.util.List;

/**
 * Publiczny kontrakt modułu portfela dla innych modułów (automaty pobierają zakłady i wypłacają wygrane,
 * raporty czytają ranking i gospodarkę). Inne moduły nie widzą encji {@code Wallet} ani repozytoriów:
 * tylko ten interfejs i rekordy z pakietu {@code api}.
 *
 * <p>Każda metoda zmieniająca saldo dołącza do transakcji wywołującego (np. spinu), więc zakład, zapis rundy
 * i wypłata wygranej zatwierdzają się razem albo wcale.
 */
public interface WalletFacade {

    /**
     * Pobiera zakład.
     *
     * @param spinRoundId identyfikator rundy, której dotyczy zakład (może być {@code null})
     * @return saldo po operacji
     * @throws pl.wsb.kasyno.wallet.domain.InsufficientFundsException gdy saldo jest za małe
     */
    BigDecimal debit(Long playerId, BigDecimal amount, String gameCode, Long spinRoundId);

    /**
     * Wypłaca wygraną.
     *
     * @return saldo po operacji
     */
    BigDecimal credit(Long playerId, BigDecimal amount, String gameCode, Long spinRoundId);

    /** Aktualne saldo gracza. */
    BigDecimal balance(Long playerId);

    /** Ranking najwyższych sald. */
    List<BalanceLeader> topBalances(int limit);

    /** Pytanie inwestora 4 (gracze „na zero” i cebuliony w obiegu). */
    WalletEconomy economy(BigDecimal minBet);
}
