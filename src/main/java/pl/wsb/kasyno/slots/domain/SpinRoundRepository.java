package pl.wsb.kasyno.slots.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.wsb.kasyno.slots.api.GamePopularity;
import pl.wsb.kasyno.slots.api.GameRtp;
import pl.wsb.kasyno.slots.api.HourlyActivity;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Dostęp do rund gry oraz zapytania raportowe („pytania inwestora” 1, 2 i 5).
 *
 * <p>Zapytania raportowe zwracają rekordy ({@code select new pl.wsb...Rekord(...)}), a nie encje: baza liczy
 * sumy i średnie ({@code GROUP BY}), a do Javy trafia kilka wierszy zamiast tysięcy rund. Liczymy tylko rundy
 * rozliczone ({@code SETTLED}).
 */
public interface SpinRoundRepository extends JpaRepository<SpinRound, Long> {

    /**
     * Runda gracza o danym kluczu idempotencji (powtórzone żądanie spinu). {@code join fetch} pobiera od razu
     * automat, bo porównujemy kod gry.
     */
    @Query("""
            select r from SpinRound r join fetch r.slotMachine
            where r.player.id = :playerId and r.idempotencyKey = :key
            """)
    Optional<SpinRound> findByPlayerAndIdempotencyKey(@Param("playerId") Long playerId, @Param("key") String key);

    /**
     * Historia gracza (od najnowszej), stronicowana. Projekcja {@link RoundSummary} zamiast encji: bez kolumny
     * {@code result_json} (uzasadnienie w Javadoc rekordu), z nazwą gry w tym samym zapytaniu.
     */
    @Query(value = """
            select new pl.wsb.kasyno.slots.domain.RoundSummary(r.id, p.displayName, m.code, m.name, r.bet,
                   r.totalWin, r.multiplier, r.tier, r.status, r.createdAt, r.settledAt)
            from SpinRound r join r.player p join r.slotMachine m
            where p.id = :playerId
            order by r.createdAt desc, r.id desc
            """,
            countQuery = "select count(r) from SpinRound r where r.player.id = :playerId")
    Page<RoundSummary> findPlayerHistory(@Param("playerId") Long playerId, Pageable pageable);

    /**
     * Pytanie inwestora 1: które automaty są najpopularniejsze od {@code since} (np. ostatnie 7 dni)?
     * {@code left join ... on} z warunkami w {@code on}: automat bez rund też pojawi się w wyniku (z zerem).
     */
    @Query("""
            select new pl.wsb.kasyno.slots.api.GamePopularity(m.code, m.name, count(r.id), sum(r.bet))
            from SlotMachine m
            left join SpinRound r on r.slotMachine = m and r.status = :status and r.createdAt >= :since
            where m.active = true
            group by m.id, m.code, m.name
            order by count(r.id) desc, m.id asc
            """)
    List<GamePopularity> findPopularity(@Param("since") Instant since, @Param("status") SpinStatus status);

    /** Pytanie inwestora 2: jaki jest rzeczywisty RTP każdego automatu w porównaniu z docelowym? */
    @Query("""
            select new pl.wsb.kasyno.slots.api.GameRtp(m.code, m.name, m.targetRtp, count(r.id), sum(r.bet), sum(r.totalWin))
            from SlotMachine m
            left join SpinRound r on r.slotMachine = m and r.status = :status
            group by m.id, m.code, m.name, m.targetRtp
            order by m.id asc
            """)
    List<GameRtp> findRtp(@Param("status") SpinStatus status);

    /**
     * Pytanie inwestora 5: o jakich godzinach gra się najwięcej i jaki jest średni zakład?
     * {@code extract(hour from ...)} wyciąga godzinę z daty (UTC), a {@code group by} grupuje po niej.
     */
    @Query("""
            select new pl.wsb.kasyno.slots.api.HourlyActivity(extract(hour from r.createdAt), count(r.id), avg(r.bet))
            from SpinRound r
            where r.status = :status
            group by extract(hour from r.createdAt)
            order by extract(hour from r.createdAt) asc
            """)
    List<HourlyActivity> findHourlyActivity(@Param("status") SpinStatus status);

    /**
     * Feed dużych wygranych: ostatnie rundy z wygraną ≥ {@code minMultiplier} × zakład. Gracz i automat dołączone
     * w tym samym zapytaniu (jedno zapytanie zamiast 1 + 2·N, problem N+1), a wynik to lekka projekcja
     * {@link RoundSummary} bez kolumny {@code result_json}: lobby odpytuje feed co chwilę.
     * Porównujemy {@code totalWin >= bet × próg} (dokładnie), a nie zaokrąglony {@code multiplier}.
     */
    @Query("""
            select new pl.wsb.kasyno.slots.domain.RoundSummary(r.id, p.displayName, m.code, m.name, r.bet,
                   r.totalWin, r.multiplier, r.tier, r.status, r.createdAt, r.settledAt)
            from SpinRound r join r.player p join r.slotMachine m
            where r.status = :status and r.totalWin >= r.bet * :minMultiplier
            order by r.createdAt desc, r.id desc
            """)
    List<RoundSummary> findBigWins(@Param("status") SpinStatus status, @Param("minMultiplier") BigDecimal minMultiplier,
                                   Pageable pageable);
}
