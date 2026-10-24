package pl.wsb.kasyno.slots.application;

import pl.wsb.kasyno.slots.entity.SpinRound;
import pl.wsb.kasyno.slots.entity.SpinStatus;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Wynik spinu zwracany przez {@link SpinService} (warstwa web zamienia go na odpowiedź HTTP).
 *
 * @param roundId    identyfikator rundy
 * @param gameCode   kod gry
 * @param bet        zakład
 * @param win        łączna wygrana
 * @param multiplier wygrana jako wielokrotność zakładu
 * @param tier       poziom wygranej ({@code none} … {@code ultra})
 * @param status     status rundy (po udanym spinie {@code SETTLED})
 * @param balance    saldo gracza po rundzie
 * @param replayed   {@code true}, gdy to powtórzone żądanie z tym samym kluczem (runda nie była losowana ponownie)
 * @param resultJson przebieg rundy z silnika gry (kroki animacji)
 * @param createdAt  kiedy runda się rozpoczęła (UTC)
 */
public record SpinResult(
        Long roundId,
        String gameCode,
        BigDecimal bet,
        BigDecimal win,
        BigDecimal multiplier,
        String tier,
        SpinStatus status,
        BigDecimal balance,
        boolean replayed,
        String resultJson,
        Instant createdAt) {

    static SpinResult of(SpinRound round, BigDecimal balance, boolean replayed) {
        return new SpinResult(
                round.getId(),
                round.getSlotMachine().getCode(),
                round.getBet(),
                round.getTotalWin(),
                round.getMultiplier(),
                round.getTier().code(),
                round.getStatus(),
                balance,
                replayed,
                round.getResultJson(),
                round.getCreatedAt());
    }
}
