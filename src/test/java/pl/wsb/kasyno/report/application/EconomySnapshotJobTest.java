package pl.wsb.kasyno.report.application;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.scheduling.annotation.Scheduled;
import pl.wsb.kasyno.shared.domain.Money;
import pl.wsb.kasyno.slots.api.GamePopularity;
import pl.wsb.kasyno.slots.api.SlotsFacade;
import pl.wsb.kasyno.support.MutableClock;
import pl.wsb.kasyno.wallet.api.WalletEconomy;
import pl.wsb.kasyno.wallet.api.WalletFacade;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Migawka gospodarki: liczymy ją wprost z zegarem testowym, zamiast czekać na harmonogram (pełna godzina).
 * Fasady modułów są atrapami, więc sprawdzamy dokładnie, o co zadanie pyta (okno „ostatniej godziny”).
 */
@ExtendWith(OutputCaptureExtension.class)
@DisplayName("LAB 06: migawka gospodarki (@Scheduled) z zegarem testowym")
class EconomySnapshotJobTest {

    private static final Instant NOW = Instant.parse("2026-10-11T15:00:00Z");

    private final SlotsFacade slots = mock(SlotsFacade.class);
    private final WalletFacade wallet = mock(WalletFacade.class);
    private final EconomySnapshotJob job = new EconomySnapshotJob(slots, wallet, new MutableClock(NOW));

    private final Logger jobLogger = (Logger) LoggerFactory.getLogger(EconomySnapshotJob.class);
    private Level previousLevel;

    @BeforeEach
    void setUp() {
        when(slots.minimumBet()).thenReturn(Money.of(10));
        when(wallet.economy(Money.of(10))).thenReturn(new WalletEconomy(12, 3, Money.of(98_500),
                Money.of(120_000), Money.of(30_000)));
        when(slots.popularGames(NOW.minus(EconomySnapshotJob.WINDOW))).thenReturn(List.of(
                new GamePopularity("cebulowy-777", "Cebulowy 777", 40L, Money.of(4_000)),
                new GamePopularity("zloty-faraon", "Złoty Faraon", 10L, Money.of(2_000)),
                new GamePopularity("krysztalowa-kaskada", "Kryształowa Kaskada", null, null)));
        // inne testy (kontekst Springa z profilem test) ustawiają globalnie poziom WARN; tu chcemy widzieć INFO
        previousLevel = jobLogger.getLevel();
        jobLogger.setLevel(Level.INFO);
    }

    @AfterEach
    void restoreLevel() {
        jobLogger.setLevel(previousLevel);
    }

    @Test
    @DisplayName("migawka: gospodarka z portfela + spiny i zakłady z ostatniej godziny (okno liczone z Clock)")
    void snapshot() {
        EconomySnapshot snapshot = job.takeSnapshot();

        verify(slots).popularGames(Instant.parse("2026-10-11T14:00:00Z"));
        assertThat(snapshot.at()).isEqualTo(NOW);
        assertThat(snapshot.players()).isEqualTo(12);
        assertThat(snapshot.bankruptPlayers()).isEqualTo(3);
        assertThat(snapshot.coinsInCirculation()).isEqualByComparingTo("98500");
        assertThat(snapshot.totalRescueBonus()).isEqualByComparingTo("30000");
        assertThat(snapshot.spinsLastHour()).isEqualTo(50);
        assertThat(snapshot.wageredLastHour()).isEqualByComparingTo("6000");
    }

    @Test
    @DisplayName("metoda harmonogramu zapisuje jedną linię logu klucz=wartość")
    void logLine(CapturedOutput output) {
        job.logSnapshot();

        assertThat(output.getOut()).contains("economy_snapshot at=2026-10-11T15:00:00Z players=12 bankrupt=3 "
                + "coins_in_circulation=98500 welcome_bonus_total=120000 rescue_bonus_total=30000 "
                + "spins_last_hour=50 wagered_last_hour=6000");
    }

    @Test
    @DisplayName("harmonogram: cron z kasyno.schedule.economy-snapshot-cron (domyślnie co pełną godzinę), strefa UTC")
    void cronFromProperties() throws NoSuchMethodException {
        Scheduled scheduled = EconomySnapshotJob.class.getMethod("logSnapshot").getAnnotation(Scheduled.class);

        assertThat(scheduled.cron()).isEqualTo("${kasyno.schedule.economy-snapshot-cron:0 0 * * * *}");
        assertThat(scheduled.zone()).isEqualTo("UTC");
    }

    @Test
    @DisplayName("pusta baza: zera zamiast błędu")
    void empty() {
        when(slots.popularGames(NOW.minus(EconomySnapshotJob.WINDOW))).thenReturn(List.of());

        EconomySnapshot snapshot = job.takeSnapshot();

        assertThat(snapshot.spinsLastHour()).isZero();
        assertThat(snapshot.wageredLastHour()).isEqualByComparingTo(BigDecimal.ZERO);
    }
}
