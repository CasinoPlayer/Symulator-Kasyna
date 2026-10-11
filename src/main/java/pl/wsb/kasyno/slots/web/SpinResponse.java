package pl.wsb.kasyno.slots.web;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Kształt odpowiedzi na spin (kontrakt API § 2.4) opisany typami Javy dla dokumentacji OpenAPI (Swagger UI).
 *
 * <p>W działaniu kontroler <b>nie</b> buduje tego rekordu: wysyła dokument rundy zapisany w
 * {@code spin_round.result_json} ({@code SpinDocument}), dzięki czemu powtórka z tym samym {@code Idempotency-Key}
 * jest identyczna co do bajtu. Ten rekord istnieje, żeby Swagger pokazał pola i ich znaczenie zamiast „string”.
 *
 * @param roundId       identyfikator rundy
 * @param gameCode      kod gry
 * @param bet           zakład całkowity (pobrany raz, także gdy runda zawiera darmowe spiny)
 * @param totalWin      suma wszystkich wygranych rundy
 * @param multiplier    {@code totalWin / bet}
 * @param tier          {@code none}, {@code small}, {@code medium}, {@code big}, {@code mega}, {@code epic}, {@code ultra}
 * @param balanceBefore saldo przed pobraniem zakładu
 * @param balanceAfter  saldo po zaksięgowaniu wygranej
 * @param seed          ziarno losowania rundy (16 cyfr szesnastkowych)
 * @param steps         kroki animacji: {@code spin}, {@code win}, {@code cascade}, {@code expandWild}, {@code feature},
 *                      {@code applyMultiplier}, {@code freeSpinsStart}, {@code freeSpinsRetrigger}, {@code freeSpinsEnd}
 */
@Schema(description = "Odpowiedź spinu: cała runda jako lista kroków animacji (docs/projekt/09 § 2.4)")
public record SpinResponse(
        @Schema(example = "1042") Long roundId,
        @Schema(example = "zloty-faraon") String gameCode,
        @Schema(example = "100") BigDecimal bet,
        @Schema(example = "2350") BigDecimal totalWin,
        @Schema(example = "23.5") BigDecimal multiplier,
        @Schema(example = "big") String tier,
        @Schema(example = "10000") BigDecimal balanceBefore,
        @Schema(example = "12250") BigDecimal balanceAfter,
        @Schema(example = "5f3a9c0e7b21d4a8") String seed,
        @Schema(description = "Kroki animacji w kolejności odgrywania (pole type)") List<Map<String, Object>> steps) {
}
