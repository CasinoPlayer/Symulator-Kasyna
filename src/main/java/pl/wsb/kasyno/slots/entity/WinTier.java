package pl.wsb.kasyno.slots.entity;

import java.math.BigDecimal;
import java.util.Locale;

/**
 * Poziom wygranej liczony jako wielokrotność zakładu (wspólny dla wszystkich gier). Front na jego podstawie
 * dobiera prezentację: od krótkiego podświetlenia ({@code small}) po pełnoekranową sekwencję „ULTRA WIN”.
 *
 * <p>Progi są stałe (ustalone w briefie projektu), dlatego trzymamy je w enumie, a nie w konfiguracji.
 * Kolejność stałych ma znaczenie: od najwyższego progu w dół szukamy pierwszego spełnionego.
 */
public enum WinTier {

    /** Brak wygranej. */
    NONE(null),
    /** Wygrana większa od zera i mniejsza niż 5× zakładu. */
    SMALL(BigDecimal.ZERO),
    MEDIUM(BigDecimal.valueOf(5)),
    BIG(BigDecimal.valueOf(15)),
    MEGA(BigDecimal.valueOf(30)),
    EPIC(BigDecimal.valueOf(60)),
    ULTRA(BigDecimal.valueOf(100));

    /** Próg jako wielokrotność zakładu (dla SMALL: „więcej niż 0”). */
    private final BigDecimal threshold;

    WinTier(BigDecimal threshold) {
        this.threshold = threshold;
    }

    /** Poziom dla wygranej {@code win} przy zakładzie {@code bet}. Porównujemy {@code win >= bet × próg}. */
    public static WinTier of(BigDecimal win, BigDecimal bet) {
        if (win == null || win.signum() <= 0) {
            return NONE;
        }
        WinTier[] tiers = values();
        for (int i = tiers.length - 1; i > SMALL.ordinal(); i--) {
            if (win.compareTo(bet.multiply(tiers[i].threshold)) >= 0) {
                return tiers[i];
            }
        }
        return SMALL;
    }

    /** Identyfikator dla front-endu: małe litery, jak w briefie ({@code none}, {@code small}, …, {@code ultra}). */
    public String code() {
        return name().toLowerCase(Locale.ROOT);
    }
}
