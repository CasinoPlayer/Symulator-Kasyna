package pl.wsb.kasyno.wallet.domain;

/**
 * Rodzaj operacji w portfelu. W bazie zapisany jako tekst ({@code @Enumerated(EnumType.STRING)}), więc dopisanie
 * nowej wartości w środku listy nie zmieni znaczenia starych wierszy (przy {@code ORDINAL} by zmieniło).
 */
public enum TransactionType {

    /** Bonus powitalny przy pierwszym logowaniu (10 000). */
    WELCOME_BONUS,
    /** Bonus ratunkowy dla „bankruta” (10 000, raz na 10 minut). */
    RESCUE_BONUS,
    /** Zakład w grze; kwota ujemna (zmniejsza saldo). */
    BET,
    /** Wygrana w grze; kwota dodatnia. */
    WIN
}
