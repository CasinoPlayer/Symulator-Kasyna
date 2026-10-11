package pl.wsb.kasyno.report.application;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Migawka gospodarki kasyna w danej chwili (wynik zadania {@link EconomySnapshotJob}).
 *
 * @param at                 chwila migawki (UTC)
 * @param players            liczba graczy z portfelem
 * @param bankruptPlayers    gracze z saldem poniżej najmniejszego zakładu
 * @param coinsInCirculation suma wszystkich sald
 * @param totalWelcomeBonus  suma rozdanych bonusów powitalnych od początku
 * @param totalRescueBonus   suma rozdanych bonusów ratunkowych od początku
 * @param spinsLastHour      rozliczone rundy z ostatniej godziny (wszystkie automaty)
 * @param wageredLastHour    suma zakładów z ostatniej godziny
 */
public record EconomySnapshot(
        Instant at,
        long players,
        long bankruptPlayers,
        BigDecimal coinsInCirculation,
        BigDecimal totalWelcomeBonus,
        BigDecimal totalRescueBonus,
        long spinsLastHour,
        BigDecimal wageredLastHour) {

    /**
     * Jedna linia logu w formacie {@code klucz=wartość} (tzw. logfmt): czytelna dla człowieka w konsoli i łatwa do
     * przefiltrowania ({@code grep economy_snapshot}) albo wczytania do arkusza.
     */
    public String toLogLine() {
        return "economy_snapshot at=%s players=%d bankrupt=%d coins_in_circulation=%s welcome_bonus_total=%s "
                .formatted(at, players, bankruptPlayers, plain(coinsInCirculation), plain(totalWelcomeBonus))
                + "rescue_bonus_total=%s spins_last_hour=%d wagered_last_hour=%s"
                .formatted(plain(totalRescueBonus), spinsLastHour, plain(wageredLastHour));
    }

    private static String plain(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString();
    }
}
