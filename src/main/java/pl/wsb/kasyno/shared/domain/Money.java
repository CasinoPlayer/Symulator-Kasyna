package pl.wsb.kasyno.shared.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Drobne operacje na kwotach w cebulionach, wspólne dla modułów.
 *
 * <p>Po co: kwoty to {@link BigDecimal} (dokładna arytmetyka dziesiętna; {@code double} gubi grosze, np.
 * {@code 0.1 + 0.2 != 0.3}). W bazie mają 2 miejsca po przecinku ({@code DECIMAL(19,2)}), więc wszystkie kwoty
 * sprowadzamy do tej samej skali. Porównujemy je przez {@code compareTo}, bo {@code equals} w {@code BigDecimal}
 * uwzględnia skalę ({@code 10.0} i {@code 10.00} nie są „równe”).
 */
public final class Money {

    /** Liczba miejsc po przecinku kwot w bazie. */
    public static final int SCALE = 2;

    private Money() {
    }

    /** Kwota w skali bazy danych (2 miejsca po przecinku). */
    public static BigDecimal normalize(BigDecimal amount) {
        return amount.setScale(SCALE, RoundingMode.HALF_UP);
    }

    /** Kwota z liczby całkowitej cebulionów. */
    public static BigDecimal of(long amount) {
        return normalize(BigDecimal.valueOf(amount));
    }

    public static boolean isPositive(BigDecimal amount) {
        return amount != null && amount.signum() > 0;
    }

    /** Powyżej tylu cyfr (przed albo po przecinku) nie rozpisujemy liczby „w zapisie zwykłym”. */
    private static final int MAX_PLAIN_DIGITS = 30;

    /**
     * Kwota do komunikatu dla człowieka: {@code 100.00 → "100"}, {@code 95.50 → "95.5"}.
     *
     * <p>Po co osobna metoda: kwota z żądania może być absurdalna, np. {@code 1e999999999}. Jej
     * {@code toPlainString()} to tekst z miliardem zer, a więc {@code OutOfMemoryError} przy samym budowaniu
     * komunikatu błędu. Rozsądne liczby rozpisujemy normalnie, a absurdalne zostają w zapisie naukowym
     * ({@code 1E+999999999}), który ma kilkanaście znaków.
     */
    public static String describe(BigDecimal amount) {
        if (amount == null) {
            return "(brak)";
        }
        BigDecimal stripped = amount.stripTrailingZeros();
        long integerDigits = (long) stripped.precision() - stripped.scale();
        if (integerDigits > MAX_PLAIN_DIGITS || stripped.scale() > MAX_PLAIN_DIGITS) {
            return stripped.toString();
        }
        return stripped.toPlainString();
    }
}
