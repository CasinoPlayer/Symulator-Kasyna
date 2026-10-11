package pl.wsb.kasyno.slots.application;

import java.math.BigDecimal;

/**
 * Polecenie „zakręć”: kto, w jaką grę, za ile i z jakim kluczem idempotencji.
 *
 * @param playerId       zalogowany gracz (z sesji)
 * @param gameCode       kod gry z adresu, np. {@code cebulowy-777}
 * @param bet            zakład z ciała żądania
 * @param idempotencyKey wartość nagłówka {@code Idempotency-Key} albo {@code null}
 */
public record SpinCommand(Long playerId, String gameCode, BigDecimal bet, String idempotencyKey) {
}
