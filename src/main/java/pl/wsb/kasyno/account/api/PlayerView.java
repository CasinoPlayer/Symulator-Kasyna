package pl.wsb.kasyno.account.api;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Obiekt {@code player} z kontraktu API (odpowiedź logowania, {@code GET /api/me}, bonus ratunkowy).
 *
 * <p>Leży w pakiecie {@code api}, bo zwracają go endpointy dwóch modułów ({@code account} i {@code wallet}),
 * a {@code api} to publiczny kontrakt modułu, z którego wolno korzystać innym.
 *
 * @param id                       identyfikator gracza
 * @param nick                     nazwa gracza (w pisowni z pierwszego logowania)
 * @param avatarIndex              numer awatara 0–7 (stały dla danej nazwy)
 * @param balance                  saldo w cebulionach
 * @param minBet                   najmniejszy zakład spośród gier
 * @param canRescue                czy bonus ratunkowy jest dostępny teraz
 * @param rescueAvailableInSeconds za ile sekund będzie dostępny (0, gdy nie dotyczy)
 * @param createdAt                kiedy gracz pierwszy raz wszedł do kasyna (UTC)
 */
public record PlayerView(
        Long id,
        String nick,
        int avatarIndex,
        BigDecimal balance,
        BigDecimal minBet,
        boolean canRescue,
        long rescueAvailableInSeconds,
        Instant createdAt) {
}
