package pl.wsb.kasyno.slots.application.engine;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import pl.wsb.kasyno.slots.domain.SlotMachineRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.SplittableRandom;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Testy matematyki gier metodą Monte Carlo: miliony rund prawdziwego silnika na prawdziwej konfiguracji
 * z {@code data.sql}, ze <b>stałym ziarnem</b> (wynik testu jest powtarzalny).
 *
 * <p>Jak dobraliśmy liczbę rund: błąd standardowy zmierzonego RTP to σ / √n, gdzie σ to odchylenie standardowe
 * wygranej z jednej rundy (w wielokrotnościach zakładu). Tolerancja ±0,8 p.p. ma być co najmniej 3 błędami
 * standardowymi, więc n ≥ (3σ / 0,8 p.p.)². Dla S1 (σ ≈ 3,2) wystarczą 2 mln rund, dla S2 (σ ≈ 8,4) potrzeba
 * ~10 mln, dla S3 (σ ≈ 9,4) ~14 mln. Mniejsza próba (np. 300 tys. rund S3: błąd ±1,7 p.p.) nie potrafiłaby
 * odróżnić RTP 96% od 94%. Dla S1 liczymy też RTP <b>dokładnie</b>: przechodzimy wszystkie 32³ układów bębnów.
 *
 * <p>Rundy liczymy równolegle w {@value #CHUNKS} porcjach; każda porcja ma własny generator wydzielony
 * ({@link SplittableRandom#split()}) z ziarna testu w ustalonej kolejności, więc wynik nie zależy od liczby rdzeni
 * ani kolejności wątków. Każda runda dostaje własne 64-bitowe ziarno, dokładnie jak w aplikacji.
 */
@DataJpaTest(showSql = false)
@ActiveProfiles("test")
@Import(GameMathProvider.class)
@DisplayName("Matematyka gier: RTP, trafienia i darmowe spiny (Monte Carlo, stały seed)")
class SlotMathMonteCarloTest {

    static final long SEED = 20_261_011L;
    static final int CHUNKS = 16;
    private static final double TOLERANCE_PP = 0.8;

    private static ExecutorService pool;

    @Autowired
    private SlotMachineRepository machines;
    @Autowired
    private GameMathProvider mathProvider;

    @BeforeAll
    static void startPool() {
        pool = Executors.newFixedThreadPool(Math.max(1, Math.min(CHUNKS, Runtime.getRuntime().availableProcessors())));
    }

    @AfterAll
    static void stopPool() {
        pool.shutdownNow();
    }

    private GameMath math(String code) {
        return mathProvider.mathFor(machines.findByCodeAndActiveTrue(code).orElseThrow());
    }

    @Test
    @DisplayName("S1 Cebulowy 777: dokładne RTP ze wszystkich 32 768 układów bębnów ≈ 95%, trafienia 30–35%")
    void cebulowyExactRtp() {
        GameMath math = math(SlotEnginesConfig.CEBULOWY_777);
        LinesEngine engine = new LinesEngine(SlotEnginesConfig.CEBULOWY_777, SlotEnginesConfig.CEBULOWY_777_RULES, null);
        int[][] strips = math.strips(false);
        long bet = 10;
        MathStats stats = new MathStats();
        for (int a = 0; a < strips[0].length; a++) {
            for (int b = 0; b < strips[1].length; b++) {
                for (int c = 0; c < strips[2].length; c++) {
                    int[] stops = {a, b, c};
                    int[] next = {0};
                    stats.add(engine.playRound(math, bet, bound -> stops[next[0]++]), bet);
                }
            }
        }
        stats.print("S1 dokładnie (wszystkie układy)", 0);

        assertThat(stats.rounds).isEqualTo(32_768);
        assertThat(stats.rtpPercent()).isCloseTo(95.0, within(TOLERANCE_PP));
        // wartość wyliczona też niezależnie (model w Pythonie, docs/projekt/07); zmiana data.sql = zmiana dokumentu
        assertThat(stats.rtpPercent()).isCloseTo(94.892, within(0.001));
        assertThat(stats.hitRate()).isBetween(0.30, 0.35);
        assertThat(stats.neonJackpots).isEqualTo(4);
    }

    @Test
    @DisplayName("S1 Cebulowy 777: 2 mln rund, RTP 95% ± 0,8 p.p.")
    void cebulowyMonteCarlo() throws Exception {
        LinesEngine engine = new LinesEngine(SlotEnginesConfig.CEBULOWY_777, SlotEnginesConfig.CEBULOWY_777_RULES, null);
        MathStats stats = simulate(engine, math(SlotEnginesConfig.CEBULOWY_777), 10, 2_000_000);
        stats.print("S1 Cebulowy 777", SEED);

        assertThat(stats.rtpPercent()).isCloseTo(95.0, within(TOLERANCE_PP));
        assertThat(stats.hitRate()).isBetween(0.30, 0.35);
        assertThat(stats.maxWinReached).isZero();
    }

    @Test
    @DisplayName("S2 Złoty Faraon: 10 mln rund, RTP 96% ± 0,8 p.p., trafienia 25–30%, darmowe spiny 1/150–1/200")
    void faraonMonteCarlo() throws Exception {
        LinesEngine engine = new LinesEngine(SlotEnginesConfig.ZLOTY_FARAON, SlotEnginesConfig.ZLOTY_FARAON_RULES, null);
        MathStats stats = simulate(engine, math(SlotEnginesConfig.ZLOTY_FARAON), 20, 10_000_000);
        stats.print("S2 Złoty Faraon", SEED);

        assertThat(stats.rtpPercent()).isCloseTo(96.0, within(TOLERANCE_PP));
        assertThat(stats.standardErrorPp() * 3).isLessThanOrEqualTo(TOLERANCE_PP);
        assertThat(stats.hitRate()).isBetween(0.25, 0.30);
        assertThat(stats.freeSpinsOneIn()).isBetween(150.0, 200.0);
    }

    @Test
    @DisplayName("S3 Kryształowa Kaskada: 14 mln rund, RTP 96% ± 0,8 p.p., trafienia 25–35%, darmowe spiny 1/200–1/300")
    void kaskadaMonteCarlo() throws Exception {
        ClusterEngine engine = new ClusterEngine(SlotEnginesConfig.KRYSZTALOWA_KASKADA,
                SlotEnginesConfig.KRYSZTALOWA_KASKADA_RULES, null);
        MathStats stats = simulate(engine, math(SlotEnginesConfig.KRYSZTALOWA_KASKADA), 20, 14_000_000);
        stats.print("S3 Kryształowa Kaskada", SEED);

        assertThat(stats.rtpPercent()).isCloseTo(96.0, within(TOLERANCE_PP));
        assertThat(stats.standardErrorPp() * 3).isLessThanOrEqualTo(TOLERANCE_PP);
        assertThat(stats.hitRate()).isBetween(0.25, 0.35);
        assertThat(stats.freeSpinsOneIn()).isBetween(200.0, 300.0);
    }

    /** {@code rounds} rund silnika, równolegle w {@link #CHUNKS} deterministycznych porcjach. */
    static MathStats simulate(ConfiguredSlotEngine engine, GameMath math, long bet, long rounds) throws Exception {
        SplittableRandom master = new SplittableRandom(SEED);
        List<Future<MathStats>> parts = new ArrayList<>();
        for (int chunk = 0; chunk < CHUNKS; chunk++) {
            SplittableRandom seeds = master.split();
            long count = rounds / CHUNKS + (chunk < rounds % CHUNKS ? 1 : 0);
            parts.add(pool.submit(() -> {
                MathStats part = new MathStats();
                for (long i = 0; i < count; i++) {
                    part.add(engine.playRound(math, bet, RandomSource.fromSeed(seeds.nextLong())), bet);
                }
                return part;
            }));
        }
        MathStats total = new MathStats();
        for (Future<MathStats> part : parts) {
            total.merge(part.get());
        }
        return total;
    }

    /** Liczniki symulacji: suma zakładów i wygranych, kwadraty (do odchylenia), trafienia, darmowe spiny. */
    static final class MathStats {

        long rounds;
        long totalBet;
        long totalWin;
        double sumSquaredMultiplier;
        long hits;
        long freeSpinsTriggered;
        long freeSpinsPlayed;
        long freeSpinsWin;
        long neonJackpots;
        long maxWinReached;
        double maxMultiplier;

        void add(RoundResult round, long bet) {
            rounds++;
            totalBet += bet;
            totalWin += round.totalWin();
            double multiplier = round.totalWin() / (double) bet;
            sumSquaredMultiplier += multiplier * multiplier;
            maxMultiplier = Math.max(maxMultiplier, multiplier);
            if (round.totalWin() > 0) {
                hits++;
            }
            if (round.freeSpinsTriggered()) {
                freeSpinsTriggered++;
                freeSpinsPlayed += round.freeSpinsPlayed();
                freeSpinsWin += round.freeSpinsWin();
            }
            if (round.maxWinReached()) {
                maxWinReached++;
            }
            for (RoundStep step : round.steps()) {
                if (step instanceof RoundStep.Feature feature && RoundStep.NEON_JACKPOT.equals(feature.name())) {
                    neonJackpots++;
                }
            }
        }

        void merge(MathStats other) {
            rounds += other.rounds;
            totalBet += other.totalBet;
            totalWin += other.totalWin;
            sumSquaredMultiplier += other.sumSquaredMultiplier;
            hits += other.hits;
            freeSpinsTriggered += other.freeSpinsTriggered;
            freeSpinsPlayed += other.freeSpinsPlayed;
            freeSpinsWin += other.freeSpinsWin;
            neonJackpots += other.neonJackpots;
            maxWinReached += other.maxWinReached;
            maxMultiplier = Math.max(maxMultiplier, other.maxMultiplier);
        }

        double rtpPercent() {
            return 100.0 * totalWin / totalBet;
        }

        double hitRate() {
            return hits / (double) rounds;
        }

        /** Odchylenie standardowe wygranej z jednej rundy (w wielokrotnościach zakładu). */
        double sigma() {
            double mean = totalWin / (double) totalBet;
            return Math.sqrt(sumSquaredMultiplier / rounds - mean * mean);
        }

        double standardErrorPp() {
            return 100.0 * sigma() / Math.sqrt(rounds);
        }

        double freeSpinsOneIn() {
            return freeSpinsTriggered == 0 ? Double.POSITIVE_INFINITY : rounds / (double) freeSpinsTriggered;
        }

        void print(String label, long seed) {
            System.out.printf(Locale.ROOT, "[MATEMATYKA] %s: rundy=%d seed=%d RTP=%.3f%% (błąd std. %.3f p.p.) "
                            + "trafienia=%.2f%% sigma=%.2f FS=1/%.1f średnio FS=%.2f spinów, wygrana FS=%.1f× "
                            + "udział FS w RTP=%.1f p.p. max=%.1f× limit=%d jackpoty=%d%n",
                    label, rounds, seed, rtpPercent(), standardErrorPp(), 100 * hitRate(), sigma(), freeSpinsOneIn(),
                    freeSpinsTriggered == 0 ? 0.0 : freeSpinsPlayed / (double) freeSpinsTriggered,
                    freeSpinsTriggered == 0 ? 0.0 : freeSpinsWin / (double) freeSpinsTriggered / (totalBet / (double) rounds),
                    100.0 * freeSpinsWin / totalBet, maxMultiplier, maxWinReached, neonJackpots);
        }
    }
}
