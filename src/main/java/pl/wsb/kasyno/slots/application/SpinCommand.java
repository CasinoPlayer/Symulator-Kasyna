package pl.wsb.kasyno.slots.application;

import java.math.BigDecimal;

/**
 * Polecenie „zakręć”: kto, w jaką grę, za ile i z jakim kluczem idempotencji.
 *
 * @param playerId       zalogowany gracz (z sesji)
 * @param gameCode       kod gry z adresu, np. {@code cebulowy-777}
 * @param bet            zakład z ciała żądania
 * @param idempotencyKey wartość nagłówka {@code Idempotency-Key} albo {@code null}
 * @param demoSeed       ziarno rundy narzucone w profilu {@code demo} (nagłówek {@code X-Demo-Seed}) albo {@code null},
 *                       gdy ziarno ma wylosować {@code SecureRandom}. Kontroler wypełnia je wyłącznie przy
 *                       {@code kasyno.demo.allow-seed=true}; w pozostałych profilach jest zawsze {@code null}
 */
public record SpinCommand(Long playerId, String gameCode, BigDecimal bet, String idempotencyKey, Long demoSeed) {

    /** Zwykły spin (ziarno losowe), czyli wszystko poza nagrywaniem filmików w profilu {@code demo}. */
    public SpinCommand(Long playerId, String gameCode, BigDecimal bet, String idempotencyKey) {
        this(playerId, gameCode, bet, idempotencyKey, null);
    }
}
