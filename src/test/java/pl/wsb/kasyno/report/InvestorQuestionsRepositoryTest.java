package pl.wsb.kasyno.report;

import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import pl.wsb.kasyno.account.domain.UserAccount;
import pl.wsb.kasyno.shared.domain.Money;
import pl.wsb.kasyno.slots.api.BiggestWinLeader;
import pl.wsb.kasyno.slots.api.GamePopularity;
import pl.wsb.kasyno.slots.api.GameRtp;
import pl.wsb.kasyno.slots.api.HourlyActivity;
import pl.wsb.kasyno.slots.api.PlayerResult;
import pl.wsb.kasyno.slots.application.SlotCatalogService;
import pl.wsb.kasyno.slots.application.SlotStatisticsService;
import pl.wsb.kasyno.slots.entity.PlayerMachineStats;
import pl.wsb.kasyno.slots.entity.PlayerMachineStatsRepository;
import pl.wsb.kasyno.slots.entity.SlotMachine;
import pl.wsb.kasyno.slots.entity.SlotMachineRepository;
import pl.wsb.kasyno.slots.entity.RoundSummary;
import pl.wsb.kasyno.slots.entity.SpinRound;
import pl.wsb.kasyno.slots.entity.SpinRoundRepository;
import pl.wsb.kasyno.slots.entity.SpinStatus;
import pl.wsb.kasyno.slots.entity.WinTier;
import pl.wsb.kasyno.support.TestData;
import pl.wsb.kasyno.wallet.api.BalanceLeader;
import pl.wsb.kasyno.wallet.entity.TransactionType;
import pl.wsb.kasyno.wallet.entity.Wallet;
import pl.wsb.kasyno.wallet.entity.WalletRepository;
import pl.wsb.kasyno.wallet.entity.WalletTransactionRepository;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * „Pytania inwestora” na prawdziwej bazie H2: {@code @DataJpaTest} uruchamia tylko warstwę JPA (encje,
 * repozytoria, schemat z Hibernate), każdy test działa w transakcji wycofywanej na końcu.
 * {@code data.sql} wyłączamy, żeby test miał wyłącznie własne, przewidywalne dane.
 */
@DataJpaTest(showSql = false)
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.sql.init.mode=never")
@DisplayName("Pytania inwestora i rankingi (JPQL, @DataJpaTest)")
class InvestorQuestionsRepositoryTest {

    private static final Instant NOW = Instant.parse("2026-10-11T12:00:00Z");

    @Autowired
    private TestEntityManager em;
    @Autowired
    private SpinRoundRepository rounds;
    @Autowired
    private PlayerMachineStatsRepository stats;
    @Autowired
    private SlotMachineRepository machines;
    @Autowired
    private WalletRepository wallets;
    @Autowired
    private WalletTransactionRepository transactions;
    @Autowired
    private EntityManagerFactory entityManagerFactory;

    private UserAccount kamil;
    private UserAccount ola;
    private UserAccount kuba;
    private SlotMachine s1;
    private SlotMachine s3;
    private SlotMachine unused;

    @BeforeEach
    void setUp() {
        kamil = em.persist(TestData.player("Kamil"));
        ola = em.persist(TestData.player("Ola"));
        kuba = em.persist(TestData.player("Kuba"));
        s1 = em.persist(TestData.cebulowy777());
        s3 = em.persist(TestData.kaskada());
        unused = em.persist(new SlotMachine("zloty-faraon", "Złoty Faraon", pl.wsb.kasyno.slots.entity.EngineType.LINES,
                5, 3, 20, pl.wsb.kasyno.slots.entity.BetLevels.parse("20,40"), new BigDecimal("96.00"),
                pl.wsb.kasyno.slots.entity.Volatility.MEDIUM_HIGH, null));
    }

    /** Rozliczona runda (SETTLED) o podanym czasie. */
    private SpinRound settled(UserAccount player, SlotMachine machine, long bet, long win, Instant at) {
        SpinRound round = new SpinRound(player, machine, Money.of(bet), 1L, null, at);
        round.resolve(Money.of(win), "{}");
        round.settle(at);
        return em.persist(round);
    }

    private PlayerMachineStats stats(UserAccount player, SlotMachine machine, long[][] betsAndWins, Instant at) {
        PlayerMachineStats row = new PlayerMachineStats(player, machine);
        for (long[] betAndWin : betsAndWins) {
            row.record(Money.of(betAndWin[0]), Money.of(betAndWin[1]), at);
        }
        return em.persist(row);
    }

    @Test
    @DisplayName("1. najpopularniejsze automaty z 7 dni: liczymy tylko SETTLED z okresu, gra bez rund ma 0")
    void popularGames() {
        settled(kamil, s1, 10, 0, NOW.minus(Duration.ofDays(1)));
        settled(ola, s1, 20, 0, NOW.minus(Duration.ofHours(2)));
        settled(kuba, s1, 50, 0, NOW.minus(Duration.ofDays(6)));
        settled(kamil, s3, 100, 0, NOW.minus(Duration.ofDays(2)));
        settled(kamil, s3, 100, 0, NOW.minus(Duration.ofDays(30)));            // za stara
        em.persist(new SpinRound(kamil, s3, Money.of(100), 1L, null, NOW));     // STARTED: pomijamy
        em.flush();

        List<GamePopularity> result = rounds.findPopularity(NOW.minus(Duration.ofDays(7)), SpinStatus.SETTLED);

        assertThat(result).extracting(GamePopularity::gameCode)
                .containsExactly("cebulowy-777", "krysztalowa-kaskada", "zloty-faraon");
        assertThat(result).extracting(GamePopularity::spins).containsExactly(3L, 1L, 0L);
        assertThat(result.get(0).totalWagered()).isEqualByComparingTo("80");
        assertThat(result.get(2).totalWagered()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("2. rzeczywisty RTP = wygrane / zakłady × 100 (docelowy obok)")
    void rtp() {
        settled(kamil, s1, 100, 0, NOW);
        settled(ola, s1, 100, 150, NOW);
        settled(kuba, s1, 200, 230, NOW);
        em.flush();

        List<GameRtp> result = rounds.findRtp(SpinStatus.SETTLED);

        GameRtp cebulowy = result.stream().filter(r -> r.gameCode().equals("cebulowy-777")).findFirst().orElseThrow();
        assertThat(cebulowy.spins()).isEqualTo(3L);
        assertThat(cebulowy.totalWagered()).isEqualByComparingTo("400");
        assertThat(cebulowy.totalWon()).isEqualByComparingTo("380");
        assertThat(cebulowy.actualRtp()).isEqualByComparingTo("95.00");
        assertThat(cebulowy.targetRtp()).isEqualByComparingTo("95.00");

        GameRtp faraon = result.stream().filter(r -> r.gameCode().equals("zloty-faraon")).findFirst().orElseThrow();
        assertThat(faraon.spins()).isZero();
        assertThat(faraon.actualRtp()).isNull();
    }

    @Test
    @DisplayName("3. liderzy: najlepszy bilans i największa wygrana, zsumowane po automatach")
    void topPlayers() {
        stats(kamil, s1, new long[][]{{100, 0}, {100, 50}}, NOW);           // bilans -150, rekord 50
        stats(kamil, s3, new long[][]{{100, 900}}, NOW);                    // bilans +800, rekord 900 → razem +650
        stats(ola, s1, new long[][]{{1000, 3000}}, NOW);                    // bilans +2000, rekord 3000
        stats(kuba, s1, new long[][]{{500, 0}}, NOW);                       // bilans -500, bez wygranej
        em.flush();

        List<PlayerResult> byNet = stats.findTopByNetResult(PageRequest.of(0, 10));
        assertThat(byNet).extracting(PlayerResult::nick).containsExactly("Ola", "Kamil", "Kuba");
        assertThat(byNet.get(1).netResult()).isEqualByComparingTo("650");
        assertThat(byNet.get(1).spins()).isEqualTo(3L);

        List<PlayerResult> byBiggestWin = stats.findTopByBiggestWin(PageRequest.of(0, 10));
        assertThat(byBiggestWin).extracting(PlayerResult::nick).containsExactly("Ola", "Kamil");
        assertThat(byBiggestWin.get(1).biggestWin()).isEqualByComparingTo("900");
    }

    @Test
    @DisplayName("4. gospodarka: gracze „na zero”, cebuliony w obiegu, suma bonusów")
    void economy() {
        Wallet rich = new Wallet(kamil, NOW);
        rich.credit(TransactionType.WELCOME_BONUS, Money.of(10_000), null, null, NOW);
        Wallet broke = new Wallet(ola, NOW);
        broke.credit(TransactionType.WELCOME_BONUS, Money.of(10_000), null, null, NOW);
        broke.debitBet(Money.of(9_995), "cebulowy-777", null, NOW);
        em.persist(rich);
        em.persist(broke);
        em.persist(rich.credit(TransactionType.WIN, Money.of(500), "cebulowy-777", null, NOW));
        em.persist(broke.rescue(Money.of(10_000), Money.of(10), Duration.ofMinutes(10), NOW));
        em.flush();

        assertThat(wallets.count()).isEqualTo(2);
        assertThat(wallets.countByBalanceLessThan(Money.of(10))).isZero();
        assertThat(wallets.countByBalanceLessThan(Money.of(10_006))).isEqualTo(1);
        assertThat(wallets.sumBalances()).hasValueSatisfying(sum -> assertThat(sum).isEqualByComparingTo("20505"));
        assertThat(transactions.sumAmountByType(TransactionType.RESCUE_BONUS))
                .hasValueSatisfying(sum -> assertThat(sum).isEqualByComparingTo("10000"));
        assertThat(transactions.sumAmountByType(TransactionType.BET)).isEmpty();
    }

    @Test
    @DisplayName("5. godziny szczytu (UTC) i średni zakład")
    void peakHours() {
        settled(kamil, s1, 10, 0, Instant.parse("2026-10-10T18:05:00Z"));
        settled(ola, s1, 20, 0, Instant.parse("2026-10-09T18:59:00Z"));
        settled(kuba, s1, 50, 0, Instant.parse("2026-10-10T18:30:00Z"));
        settled(kamil, s3, 100, 0, Instant.parse("2026-10-10T07:15:00Z"));
        em.flush();

        List<HourlyActivity> result = rounds.findHourlyActivity(SpinStatus.SETTLED);

        assertThat(result).extracting(HourlyActivity::hour).containsExactly(7, 18);
        assertThat(result).extracting(HourlyActivity::spins).containsExactly(1L, 3L);
        assertThat(result.get(1).averageBet()).isEqualTo(80.0 / 3, org.assertj.core.data.Offset.offset(0.001));
    }

    @Test
    @DisplayName("feed: tylko wygrane ≥ 15× zakładu, od najnowszej, jednym zapytaniem (brak N+1), bez ładowania encji")
    void bigWinsFeedWithoutNPlusOne() {
        settled(kamil, s1, 10, 150, NOW.minusSeconds(30));     // 15× → tak
        settled(ola, s3, 20, 299, NOW.minusSeconds(20));       // 14,95× → nie
        settled(kuba, s1, 100, 10_000, NOW.minusSeconds(10));  // 100× → tak
        settled(ola, s1, 10, 600, NOW.minusSeconds(40));       // 60× → tak
        em.flush();
        em.clear();

        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        List<RoundSummary> feed = rounds.findBigWins(SpinStatus.SETTLED, BigDecimal.valueOf(15), PageRequest.of(0, 10));
        List<String> description = feed.stream().map(r -> r.nick() + "@" + r.gameName()).toList();

        assertThat(description).containsExactly("Kuba@Cebulowy 777", "Kamil@Cebulowy 777", "Ola@Cebulowy 777");
        assertThat(feed).extracting(RoundSummary::tier).containsExactly(WinTier.ULTRA, WinTier.BIG, WinTier.EPIC);
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(1);
        // projekcja: żadna encja SpinRound (z ciężką kolumną result_json) nie trafia do pamięci
        assertThat(statistics.getEntityLoadCount()).isZero();
    }

    @Test
    @DisplayName("ranking największych wygranych: jeden wiersz na gracza (jego rekord), od największego")
    void biggestWinLeaders() {
        stats(kamil, s1, new long[][]{{10, 500}}, NOW.minusSeconds(60));
        stats(kamil, s3, new long[][]{{20, 500}}, NOW.minusSeconds(30));    // remis z samym sobą
        stats(ola, s3, new long[][]{{20, 1_200}}, NOW);
        stats(kuba, s1, new long[][]{{10, 0}}, NOW);                         // bez wygranej: poza rankingiem
        em.flush();
        SlotStatisticsService service = new SlotStatisticsService(rounds, stats, new SlotCatalogService(machines));

        List<BiggestWinLeader> leaders = service.biggestWinLeaders(10);

        assertThat(leaders).extracting(BiggestWinLeader::nick).containsExactly("Ola", "Kamil");
        assertThat(leaders.get(1).gameCode()).isEqualTo("cebulowy-777");   // wcześniejszy z dwóch równych rekordów
        assertThat(leaders.get(0).win()).isEqualByComparingTo("1200");
    }

    @Test
    @DisplayName("historia gracza: stronicowanie od najnowszej, z liczbą wszystkich rund, bez ładowania encji")
    void playerHistoryPaging() {
        for (int i = 0; i < 5; i++) {
            settled(kamil, s1, 10, i, NOW.plusSeconds(i));
        }
        settled(ola, s1, 10, 0, NOW);
        em.flush();
        em.clear();

        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        Page<RoundSummary> page = rounds.findPlayerHistory(kamil.getId(), PageRequest.of(0, 2));

        assertThat(page.getTotalElements()).isEqualTo(5);
        assertThat(page.getTotalPages()).isEqualTo(3);
        assertThat(page.getContent()).extracting(r -> r.win().intValue()).containsExactly(4, 3);
        assertThat(page.getContent()).extracting(RoundSummary::gameName).containsOnly("Cebulowy 777");
        assertThat(page.getContent()).extracting(RoundSummary::status).containsOnly(SpinStatus.SETTLED);
        assertThat(statistics.getEntityLoadCount()).isZero();
    }

    @Test
    @DisplayName("portfel: blokada FOR UPDATE i ranking sald")
    void walletQueries() {
        Wallet first = new Wallet(kamil, NOW);
        first.credit(TransactionType.WELCOME_BONUS, Money.of(500), null, null, NOW);
        Wallet second = new Wallet(ola, NOW);
        second.credit(TransactionType.WELCOME_BONUS, Money.of(1_500), null, null, NOW);
        em.persist(first);
        em.persist(second);
        em.flush();

        assertThat(wallets.findByPlayerIdForUpdate(kamil.getId())).containsSame(first);
        assertThat(wallets.findTopBalances(PageRequest.of(0, 10))).extracting(BalanceLeader::nick)
                .containsExactly("Ola", "Kamil");
        assertThat(machines.findLowestMinBet()).hasValueSatisfying(min -> assertThat(min).isEqualByComparingTo("10"));
        assertThat(machines.findActiveWithSymbols("krysztalowa-kaskada")).isPresent();
        assertThat(unused.getLines()).isEqualTo(20);
    }
}
