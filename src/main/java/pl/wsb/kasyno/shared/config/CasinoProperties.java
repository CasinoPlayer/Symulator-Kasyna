package pl.wsb.kasyno.shared.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
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
 * w kodzie serwisów. Można je zmienić bez kompilacji (np. w profilu {@code demo} odliczanie ratunku trwa minutę
 * zamiast dziesięciu), a testy podają własne wartości. Rekord jest niemodyfikowalny, więc nikt nie zmieni
 * konfiguracji w trakcie działania aplikacji. {@code @Validated} sprawia, że błędna wartość (np. ujemny bonus)
 * zatrzyma start aplikacji z czytelnym błędem, zamiast wyjść na jaw dopiero przy pierwszym graczu.
 *
 * <p>Każde pole ma wartość domyślną ({@code @DefaultValue}), więc aplikacja wystartuje nawet bez wpisów
 * w {@code application.properties}; wpisy są tam mimo to wypisane jawnie, z komentarzem, żeby było je widać.
 *
 * <p>Czego tu nie ma i dlaczego: progi poziomów wygranych (5×, 15×, 30×, 60×, 100×) są stałymi w enumie
 * {@code WinTier}, bo ustala je brief projektu i od nich zależy oprawa w przeglądarce (te same progi w kodzie
 * front-endu); tabele wypłat i taśmy bębnów są w {@code data.sql}, bo to dane automatów, a nie ustawienia kasyna.
 *
 * @param welcomeBonus     bonus powitalny dla nowego gracza (10 000 cebulionów)
 * @param rescueAmount     kwota bonusu ratunkowego dla „bankruta” (10 000 cebulionów)
 * @param rescueCooldown   minimalny odstęp między bonusami ratunkowymi (10 minut)
 * @param bigWinMultiplier od ilu krotności zakładu wygrana trafia do feedu dużych wygranych (15×)
 * @param nick             zasady nazwy gracza
 * @param lobby            pamięć podręczna feedu i rankingu w lobby
 * @param schedule         zadania cykliczne ({@code @Scheduled}, LAB 06)
 * @param demo             ustawienia profilu {@code demo} (nagrywanie filmików)
 * @param starterData      wczytywanie danych startowych przy trwałej bazie (profil {@code prod})
 */
@Validated
@ConfigurationProperties(prefix = "kasyno")
public record CasinoProperties(
        @DefaultValue("10000") @NotNull @Positive BigDecimal welcomeBonus,
        @DefaultValue("10000") @NotNull @Positive BigDecimal rescueAmount,
        @DefaultValue("10m") @NotNull Duration rescueCooldown,
        @DefaultValue("15") @NotNull @Positive BigDecimal bigWinMultiplier,
        @DefaultValue @NotNull @Valid Nick nick,
        @DefaultValue @NotNull @Valid Lobby lobby,
        @DefaultValue @NotNull @Valid Schedule schedule,
        @DefaultValue @NotNull Demo demo,
        @DefaultValue @NotNull StarterData starterData) {

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

    /**
     * Pamięć podręczna feedu dużych wygranych i rankingów (moduł {@code report}, klasa {@code LobbyBoardsCache}).
     *
     * <p>Wpis jest unieważniany zdarzeniem po zatwierdzeniu transakcji (spin, zmiana salda), więc zwykle jest
     * aktualny od razu. {@code cacheTtl} to tylko pas bezpieczeństwa: górna granica „nieświeżości” na wypadek
     * zmiany danych z pominięciem aplikacji (np. ręczna poprawka w konsoli H2). {@code 0s} wyłącza pamięć podręczną.
     *
     * @param cacheTtl najdłuższy czas życia wpisu (domyślnie 30 sekund)
     */
    public record Lobby(@DefaultValue("30s") @NotNull Duration cacheTtl) {
    }

    /**
     * Zadania cykliczne. Wyrażenia cron mają 6 pól Springa: sekunda, minuta, godzina, dzień, miesiąc, dzień tygodnia
     * (strefa UTC, tak jak daty w bazie i w API).
     *
     * <p>Adnotacje {@code @Scheduled} czytają te same klucze przez {@code ${kasyno.schedule...}}, bo atrybut adnotacji
     * musi być stałą albo wyrażeniem z {@code ${...}}; rekord opisuje je i sprawdza przy starcie.
     *
     * @param enabled                włącza harmonogram ({@code @EnableScheduling}); w testach {@code false}, a zadania
     *                               wywołujemy wprost, z zegarem testowym, bez czekania
     * @param economySnapshotCron    migawka gospodarki do logu (domyślnie co godzinę, o pełnej godzinie)
     * @param idempotencyCleanupCron zapominanie starych kluczy idempotencji spinów (domyślnie co godzinę, w 30. minucie)
     * @param idempotencyKeyTtl      jak długo pamiętamy klucz {@code Idempotency-Key} (domyślnie 24 godziny)
     */
    public record Schedule(
            @DefaultValue("true") boolean enabled,
            @DefaultValue("0 0 * * * *") @NotBlank String economySnapshotCron,
            @DefaultValue("0 30 * * * *") @NotBlank String idempotencyCleanupCron,
            @DefaultValue("24h") @NotNull Duration idempotencyKeyTtl) {
    }

    /**
     * Profil {@code demo} (nagrywanie filmików do lobby, plan § 7).
     *
     * @param allowSeed czy {@code POST /api/slots/{code}/spins} przyjmuje nagłówek {@code X-Demo-Seed} z ziarnem rundy.
     *                  Domyślnie {@code false}: w każdym profilu poza {@code demo} nagłówek jest ignorowany, a ziarno
     *                  zawsze losuje {@code SecureRandom} (inaczej gracz mógłby wybrać sobie wygrywającą rundę)
     */
    public record Demo(@DefaultValue("false") boolean allowSeed) {
    }

    /**
     * Dane startowe przy bazie, która przetrwa restart (profil {@code prod}: {@code ddl-auto=update}).
     *
     * @param loadWhenEmpty wczytaj {@code data.sql} tylko wtedy, gdy w bazie nie ma jeszcze automatów (pierwszy start);
     *                      przy kolejnych startach dane już są, więc skrypt się nie powtarza (brak duplikatów)
     */
    public record StarterData(@DefaultValue("false") boolean loadWhenEmpty) {
    }
}
