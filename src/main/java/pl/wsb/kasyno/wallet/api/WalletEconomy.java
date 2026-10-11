package pl.wsb.kasyno.wallet.api;

import java.math.BigDecimal;

/**
 * Pytanie inwestora 4: „Ilu graczy jest na zero i ile cebulionów jest w obiegu?”.
 *
 * @param players            liczba graczy z portfelem
 * @param bankruptPlayers    gracze z saldem poniżej najmniejszego zakładu
 * @param coinsInCirculation suma wszystkich sald
 * @param totalWelcomeBonus  suma rozdanych bonusów powitalnych
 * @param totalRescueBonus   suma rozdanych bonusów ratunkowych
 */
public record WalletEconomy(
        long players,
        long bankruptPlayers,
        BigDecimal coinsInCirculation,
        BigDecimal totalWelcomeBonus,
        BigDecimal totalRescueBonus) {
}
