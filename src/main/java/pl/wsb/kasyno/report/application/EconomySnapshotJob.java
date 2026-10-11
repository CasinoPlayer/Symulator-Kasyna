package pl.wsb.kasyno.report.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import pl.wsb.kasyno.slots.api.GamePopularity;
import pl.wsb.kasyno.slots.api.SlotsFacade;
import pl.wsb.kasyno.wallet.api.WalletEconomy;
import pl.wsb.kasyno.wallet.api.WalletFacade;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Zadanie cykliczne (LAB 06): co godzinę zapisuje w logu migawkę gospodarki kasyna.
 *
 * <p>Po co: raport „inwestora” ({@code GET /api/reports/economy}) pokazuje stan teraz, a migawka w logu daje historię
 * w czasie (ile cebulionów było w obiegu o 14:00, a ile o 15:00, ilu graczy zbankrutowało, ile spinów było w ostatniej
 * godzinie), bez nowej tabeli w bazie. Log w formacie {@code klucz=wartość} ({@link EconomySnapshot#toLogLine()})
 * da się przefiltrować i wczytać do arkusza; na Render.com logi są w panelu usługi.
 *
 * <p>Harmonogram: {@code kasyno.schedule.economy-snapshot-cron} (domyślnie {@code 0 0 * * * *}: o każdej pełnej
 * godzinie UTC; w profilu {@code demo} co minutę, żeby dało się to pokazać na obronie).
 *
 * <p>Testowalność: {@link #takeSnapshot()} jest publiczna i liczy „teraz” z {@link Clock}, więc test woła ją wprost
 * z zegarem ustawionym na wybraną chwilę, zamiast czekać na harmonogram. {@link #logSnapshot()} to cienka metoda
 * wołana przez harmonogram: liczy migawkę i zapisuje ją w logu.
 */
@Component
public class EconomySnapshotJob {

    private static final Logger log = LoggerFactory.getLogger(EconomySnapshotJob.class);

    /** Okno „ostatniej godziny” dla liczby spinów i sumy zakładów. */
    static final Duration WINDOW = Duration.ofHours(1);

    private final SlotsFacade slots;
    private final WalletFacade wallet;
    private final Clock clock;

    public EconomySnapshotJob(SlotsFacade slots, WalletFacade wallet, Clock clock) {
        this.slots = slots;
        this.wallet = wallet;
        this.clock = clock;
    }

    /**
     * Wołane przez harmonogram Springa: migawka do logu. {@code @Transactional} także tutaj, bo wywołanie
     * {@code takeSnapshot()} z wnętrza tej samej klasy omija pośrednika (proxy) Springa i adnotacja na
     * {@code takeSnapshot()} by nie zadziałała; harmonogram woła metodę przez pośrednika, więc ta działa.
     */
    @Scheduled(cron = "${kasyno.schedule.economy-snapshot-cron:0 0 * * * *}", zone = "UTC")
    @Transactional(readOnly = true)
    public void logSnapshot() {
        log.info(takeSnapshot().toLogLine());
    }

    /**
     * Liczy migawkę. Jedna transakcja tylko do odczytu: wszystkie zapytania (sumy sald, bonusów, spinów) widzą ten sam
     * moment bazy, a fasady modułów dołączają do tej transakcji.
     */
    @Transactional(readOnly = true)
    public EconomySnapshot takeSnapshot() {
        Instant now = clock.instant();
        WalletEconomy economy = wallet.economy(slots.minimumBet());
        List<GamePopularity> lastHour = slots.popularGames(now.minus(WINDOW));
        long spins = lastHour.stream().mapToLong(GamePopularity::spins).sum();
        BigDecimal wagered = lastHour.stream().map(GamePopularity::totalWagered).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new EconomySnapshot(now, economy.players(), economy.bankruptPlayers(), economy.coinsInCirculation(),
                economy.totalWelcomeBonus(), economy.totalRescueBonus(), spins, wagered);
    }
}
