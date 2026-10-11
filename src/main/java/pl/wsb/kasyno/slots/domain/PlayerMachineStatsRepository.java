package pl.wsb.kasyno.slots.domain;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.wsb.kasyno.slots.api.PlayerResult;

import java.util.List;
import java.util.Optional;

/**
 * Dostęp do statystyk gracz × automat oraz zapytania rankingowe („pytanie inwestora” 3).
 */
public interface PlayerMachineStatsRepository extends JpaRepository<PlayerMachineStats, Long> {

    Optional<PlayerMachineStats> findByPlayerIdAndSlotMachineId(Long playerId, Long slotMachineId);

    /** Statystyki gracza na wszystkich automatach (ekran „Moje statystyki”), z automatem w tym samym zapytaniu. */
    @Query("""
            select s from PlayerMachineStats s join fetch s.slotMachine m
            where s.player.id = :playerId
            order by m.id asc
            """)
    List<PlayerMachineStats> findByPlayer(@Param("playerId") Long playerId);

    /** Pytanie inwestora 3a: kto ma najlepszy bilans (wygrane − zakłady), zsumowany po wszystkich automatach? */
    @Query("""
            select new pl.wsb.kasyno.slots.api.PlayerResult(p.id, p.displayName, sum(s.spins), sum(s.totalWagered),
                                                             sum(s.totalWon), max(s.biggestWin))
            from PlayerMachineStats s join s.player p
            group by p.id, p.displayName
            order by sum(s.totalWon) - sum(s.totalWagered) desc, p.id asc
            """)
    List<PlayerResult> findTopByNetResult(Pageable pageable);

    /** Pytanie inwestora 3b: kto ma największą pojedynczą wygraną? */
    @Query("""
            select new pl.wsb.kasyno.slots.api.PlayerResult(p.id, p.displayName, sum(s.spins), sum(s.totalWagered),
                                                             sum(s.totalWon), max(s.biggestWin))
            from PlayerMachineStats s join s.player p
            group by p.id, p.displayName
            having max(s.biggestWin) > 0
            order by max(s.biggestWin) desc, p.id asc
            """)
    List<PlayerResult> findTopByBiggestWin(Pageable pageable);

    /**
     * Ranking „największa wygrana” ze szczegółami (gra, data): dla każdego gracza wiersz z jego rekordem
     * (podzapytanie wybiera maksimum gracza). Gracz z identycznym rekordem na dwóch automatach pojawi się
     * dwa razy, dlatego serwis zostawia pierwszy wiersz każdego gracza.
     */
    @Query("""
            select s from PlayerMachineStats s join fetch s.player join fetch s.slotMachine
            where s.biggestWin > 0
              and s.biggestWin = (select max(s2.biggestWin) from PlayerMachineStats s2 where s2.player = s.player)
            order by s.biggestWin desc, s.biggestWinAt asc, s.id asc
            """)
    List<PlayerMachineStats> findRecordHolders(Pageable pageable);
}
