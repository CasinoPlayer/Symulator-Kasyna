package pl.wsb.kasyno.shared.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;

/**
 * Ustawienia biznesowe kasyna w jednym miejscu (prefiks {@code kasyno} w {@code application.properties}).
 *
 * <p>Po co: liczby takie jak bonus startowy czy czas odnowienia bonusu ratunkowego nie są wpisane na sztywno
 * w kodzie serwisów. Można je zmienić bez kompilacji (np. w profilu {@code demo}), a testy podają własne wartości.
 * Rekord jest niemodyfikowalny, więc nikt nie zmieni konfiguracji w trakcie działania aplikacji.
 * {@code @Validated} sprawia, że błędna wartość (np. ujemny bonus) zatrzyma start aplikacji z czytelnym błędem.
 *
 * @param welcomeBonus     bonus powitalny dla nowego gracza (10 000 cebulionów)
 * @param rescueAmount     kwota bonusu ratunkowego dla „bankruta” (10 000 cebulionów)
 * @param rescueCooldown   minimalny odstęp między bonusami ratunkowymi (10 minut)
 * @param bigWinMultiplier od ilu krotności zakładu wygrana trafia do feedu dużych wygranych (15×)
 * @param nick             zasady nazwy gracza
 */
@Validated
@ConfigurationProperties(prefix = "kasyno")
public record CasinoProperties(
        @DefaultValue("10000") @NotNull @Positive BigDecimal welcomeBonus,
        @DefaultValue("10000") @NotNull @Positive BigDecimal rescueAmount,
        @DefaultValue("10m") @NotNull Duration rescueCooldown,
        @DefaultValue("15") @NotNull @Positive BigDecimal bigWinMultiplier,
        @DefaultValue @NotNull @Valid Nick nick) {

    /**
     * Zasady nazwy gracza (kontrakt API: 3–16 znaków, litery z polskimi znakami, cyfry, {@code _} i {@code -}).
     *
     * @param minLength      minimalna długość po obcięciu spacji
     * @param maxLength      maksymalna długość (najwyżej 60, bo tyle mieści kolumna {@code user_account.display_name})
     * @param reservedNames  nazwy zastrzeżone, porównywane w całości (np. {@code admin}, {@code krupier})
     * @param forbiddenWords fragmenty niedozwolone w dowolnym miejscu nazwy (wulgaryzmy)
     */
    public record Nick(
            @DefaultValue("3") @Min(1) int minLength,
            @DefaultValue("16") @Max(60) int maxLength,
            @DefaultValue List<String> reservedNames,
            @DefaultValue List<String> forbiddenWords) {
    }
}
