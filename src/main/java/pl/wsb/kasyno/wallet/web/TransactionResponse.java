package pl.wsb.kasyno.wallet.web;

import pl.wsb.kasyno.wallet.domain.TransactionType;
import pl.wsb.kasyno.wallet.domain.WalletTransaction;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Element historii portfela ({@code GET /api/me/transactions}). Kwota zakładu ({@code BET}) jest ujemna.
 */
public record TransactionResponse(
        Long id,
        TransactionType type,
        BigDecimal amount,
        BigDecimal balanceAfter,
        String gameCode,
        Long roundId,
        Instant createdAt) {

    /** Mapowanie encja → DTO (encja nie wychodzi poza serwer, klient widzi tylko pola z kontraktu). */
    public static TransactionResponse from(WalletTransaction transaction) {
        return new TransactionResponse(
                transaction.getId(),
                transaction.getType(),
                transaction.getAmount(),
                transaction.getBalanceAfter(),
                transaction.getGameCode(),
                transaction.getSpinRoundId(),
                transaction.getCreatedAt());
    }
}
