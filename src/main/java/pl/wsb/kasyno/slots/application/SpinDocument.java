package pl.wsb.kasyno.slots.application;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import pl.wsb.kasyno.shared.domain.Money;
import pl.wsb.kasyno.slots.domain.WinTier;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

/**
 * Dokument rundy: dokładnie odpowiedź {@code POST /api/slots/{code}/spins} z kontraktu API (§ 2.4) —
 * {@code roundId, gameCode, bet, totalWin, multiplier, tier, balanceBefore, balanceAfter, seed, steps}.
 *
 * <p>Ten sam tekst zapisujemy w {@code spin_round.result_json} i wysyłamy przeglądarce. Po co tak:
 * <ul>
 *   <li>powtórzone żądanie z tym samym {@code Idempotency-Key} dostaje <b>bajt w bajt</b> tę samą odpowiedź
 *       (z saldem sprzed i po tej rundzie), bez ponownego składania pól;</li>
 *   <li>w bazie jest pełny zapis tego, co zobaczył gracz (audyt, odtworzenie rundy z ziarna i porównanie).</li>
 * </ul>
 * Kwoty są liczbami całkowitymi (kontrakt § 1), {@code seed} to tekst szesnastkowy, bo 64-bitowa liczba nie mieści
 * się dokładnie w typie {@code number} JavaScriptu (bezpiecznie tylko do 2^53).
 */
public final class SpinDocument {

    private static final ObjectMapper MAPPER = JsonMapper.builder()
            .enable(JsonGenerator.Feature.WRITE_BIGDECIMAL_AS_PLAIN)
            .build();

    private SpinDocument() {
    }

    /**
     * Składa dokument rundy z danych rozliczenia i kroków z silnika gry.
     *
     * @param engineJson wynik silnika ({@code {"steps":[...]}}); jego pola dochodzą po polach nagłówka
     */
    public static String compose(Long roundId, String gameCode, BigDecimal bet, BigDecimal totalWin,
                                 BigDecimal balanceBefore, BigDecimal balanceAfter, long seed, String engineJson) {
        ObjectNode document = MAPPER.createObjectNode();
        document.put("roundId", roundId);
        document.put("gameCode", gameCode);
        document.put("bet", plain(bet));
        document.put("totalWin", plain(totalWin));
        document.put("multiplier", plain(multiplier(totalWin, bet)));
        document.put("tier", WinTier.of(totalWin, bet).code());
        document.put("balanceBefore", plain(balanceBefore));
        document.put("balanceAfter", plain(balanceAfter));
        document.put("seed", seedHex(seed));
        try {
            JsonNode engine = MAPPER.readTree(engineJson);
            for (Map.Entry<String, JsonNode> field : engine.properties()) {
                if (!document.has(field.getKey())) {
                    document.set(field.getKey(), field.getValue());
                }
            }
            if (!document.has("steps")) {
                document.putArray("steps");
            }
            return MAPPER.writeValueAsString(document);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Silnik gry zwrócił niepoprawny JSON", e);
        }
    }

    /** Ziarno jako 16 cyfr szesnastkowych, np. {@code 5f3a9c0e7b21d4a8} (dopełnione zerami z lewej). */
    public static String seedHex(long seed) {
        return String.format("%016x", seed);
    }

    /** Wygrana jako wielokrotność zakładu, tak samo jak w {@code SpinRound.resolve} (2 miejsca, połówki w górę). */
    static BigDecimal multiplier(BigDecimal totalWin, BigDecimal bet) {
        return totalWin.divide(bet, Money.SCALE, RoundingMode.HALF_UP);
    }

    /** {@code 100.00 → 100}, {@code 23.50 → 23.5} (zapis dziesiętny dzięki {@code WRITE_BIGDECIMAL_AS_PLAIN}). */
    private static BigDecimal plain(BigDecimal value) {
        return value.stripTrailingZeros();
    }
}
