package pl.wsb.kasyno.account.web;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

/**
 * Ciało {@code POST /api/auth/login}: {@code { "nick": "Kamil_77" }}.
 *
 * <p>Reguły nazwy (3–16 znaków, dozwolone znaki, zakazane słowa) sprawdza {@code NickPolicy}, bo odpowiedź ma mieć
 * kod {@code NICK_INVALID} / {@code NICK_FORBIDDEN} z kontraktu, a nie ogólne {@code VALIDATION_FAILED}.
 * Tu zostaje tylko bezpiecznik na absurdalnie długi tekst.
 */
public record LoginRequest(
        @Schema(description = "Nazwa gracza: 3–16 znaków, litery (także polskie), cyfry, _ i -", example = "Kamil_77")
        @Size(max = 200, message = "Nazwa gracza jest za długa")
        String nick) {
}
