package pl.wsb.kasyno.slots.web;

import com.fasterxml.jackson.annotation.JsonRawValue;
import io.swagger.v3.oas.annotations.media.Schema;
import pl.wsb.kasyno.slots.application.SpinResult;
import pl.wsb.kasyno.slots.domain.SpinStatus;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Odpowiedź na spin. Pole {@code result} to przebieg rundy wygenerowany przez silnik gry (kroki animacji:
 * obrót, linie, kaskady, darmowe spiny), wstawiony do JSON bez zmian ({@code @JsonRawValue}); jego dokładny
 * format opisuje {@code docs/projekt/07-gry-i-matematyka.md}. Pozostałe pola są wspólne dla wszystkich gier.
 *
 * @param roundId    identyfikator rundy
 * @param gameCode   kod gry
 * @param bet        zakład
 * @param win        łączna wygrana rundy
 * @param multiplier wygrana jako wielokrotność zakładu
 * @param tier       poziom wygranej: {@code none}, {@code small}, {@code medium}, {@code big}, {@code mega},
 *                   {@code epic}, {@code ultra}
 * @param status     status rundy ({@code SETTLED})
 * @param balance    saldo po rundzie
 * @param replayed   {@code true}: odpowiedź na powtórzone żądanie z tym samym {@code Idempotency-Key}
 * @param result     przebieg rundy z silnika gry
 * @param createdAt  kiedy runda się rozpoczęła (UTC)
 */
public record SpinResponse(
        Long roundId,
        String gameCode,
        BigDecimal bet,
        BigDecimal win,
        BigDecimal multiplier,
        String tier,
        SpinStatus status,
        BigDecimal balance,
        boolean replayed,
        @JsonRawValue @Schema(type = "object", description = "Przebieg rundy (format: docs/projekt/07)") String result,
        Instant createdAt) {

    public static SpinResponse from(SpinResult result) {
        return new SpinResponse(
                result.roundId(),
                result.gameCode(),
                result.bet(),
                result.win(),
                result.multiplier(),
                result.tier(),
                result.status(),
                result.balance(),
                result.replayed(),
                result.resultJson(),
                result.createdAt());
    }
}
