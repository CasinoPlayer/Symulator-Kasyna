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
     * Blokuje portfel gracza ({@code SELECT ... FOR UPDATE}) do końca bieżącej transakcji i zwraca saldo.
     *
     * <p>Po co: spin woła to <b>na samym początku</b>, zanim sprawdzi klucz idempotencji. Dzięki temu wszystkie
     * spiny jednego gracza wykonują się po kolei: drugie żądanie z tym samym {@code Idempotency-Key} czeka, aż
     * pierwsze się zatwierdzi, i dopiero wtedy szuka rundy, więc ją znajduje (powtórka zamiast drugiego zakładu).
     * Bez tego oba żądania mogłyby jednocześnie nie znaleźć rundy i dopiero unikalny indeks w bazie odrzuciłby
     * drugie (błąd w logu przy każdym podwójnym kliknięciu). Wymaga trwającej transakcji (inaczej blokada
     * skończyłaby się od razu i nic by nie dała).
     *
     * @return aktualne saldo (odczytane już pod blokadą)
     * @throws pl.wsb.kasyno.shared.error.NotLoggedInException gdy gracz nie ma portfela (nieaktualna sesja)
     */
    BigDecimal lockWallet(Long playerId);

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
