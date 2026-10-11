package pl.wsb.kasyno.report.web;

import pl.wsb.kasyno.wallet.api.WalletEconomy;

import java.math.BigDecimal;

/**
 * Pytanie inwestora 4:
 * {@code { "players", "bankruptPlayers", "coinsInCirculation", "totalWelcomeBonus", "totalRescueBonus" }}.
 */
public record EconomyResponse(long players, long bankruptPlayers, BigDecimal coinsInCirculation,
                              BigDecimal totalWelcomeBonus, BigDecimal totalRescueBonus) {

    public static EconomyResponse from(WalletEconomy economy) {
        return new EconomyResponse(economy.players(), economy.bankruptPlayers(), economy.coinsInCirculation(),
                economy.totalWelcomeBonus(), economy.totalRescueBonus());
    }
}
