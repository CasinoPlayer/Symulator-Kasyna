package pl.wsb.kasyno.slots.web;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/**
 * Ciało {@code POST /api/slots/{code}/spins}: {@code { "bet": 100 }}.
 *
 * <p>Bean Validation sprawdza tylko kształt (jest liczba, jest dodatnia, ma rozsądną liczbę cyfr → inaczej
 * {@code 400 VALIDATION_FAILED}). Czy zakład jest na liście {@code betLevels} danej gry, sprawdza logika biznesowa
 * ({@code 400 BET_INVALID}).
 *
 * <p>Po co {@code @Digits}: JSON pozwala zapisać liczbę {@code 1e999999999} (11 znaków), a Jackson zamienia ją na
 * {@link BigDecimal} bez protestu. Taka liczba „w zapisie zwykłym” ma miliard cyfr, więc samo zbudowanie komunikatu
 * błędu ({@code toPlainString()}) zjadłoby pamięć serwera (sprawdzone: {@code OutOfMemoryError}). Limit cyfr odrzuca
 * ją od razu, a sprawdzenie jest tanie (liczy cyfry z precyzji i skali, nie buduje tekstu).
 */
public record SpinRequest(
        @Schema(description = "Zakład w cebulionach (jeden z betLevels gry)", example = "100")
        @NotNull(message = "Podaj zakład")
        @Positive(message = "Zakład musi być dodatni")
        @Digits(integer = 12, fraction = 2, message = "Zakład ma za dużo cyfr")
        BigDecimal bet) {
}
