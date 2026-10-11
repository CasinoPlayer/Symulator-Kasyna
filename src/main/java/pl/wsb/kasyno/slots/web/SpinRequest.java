package pl.wsb.kasyno.slots.web;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/**
 * Ciało {@code POST /api/slots/{code}/spins}: {@code { "bet": 100 }}.
 *
 * <p>Bean Validation sprawdza tylko kształt (jest liczba, jest dodatnia → inaczej {@code 400 VALIDATION_FAILED}).
 * Czy zakład jest na liście {@code betLevels} danej gry, sprawdza logika biznesowa ({@code 400 BET_INVALID}).
 */
public record SpinRequest(
        @Schema(description = "Zakład w cebulionach (jeden z betLevels gry)", example = "100")
        @NotNull(message = "Podaj zakład")
        @Positive(message = "Zakład musi być dodatni")
        BigDecimal bet) {
}
