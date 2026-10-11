package pl.wsb.kasyno.wallet.domain;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.wsb.kasyno.wallet.api.BalanceLeader;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * Dostęp do portfeli. Pokazuje trzy rodzaje zapytań Spring Data: pochodne (z nazwy metody), JPQL z {@code @Query}
 * oraz zapytanie z blokadą pesymistyczną.
 */
public interface WalletRepository extends JpaRepository<Wallet, Long> {

    /** Zapytanie pochodne: {@code where user_id = ?} (ścieżka {@code player.id}). */
    Optional<Wallet> findByPlayerId(Long playerId);

    boolean existsByPlayerId(Long playerId);

    /**
     * Portfel z blokadą zapisu ({@code SELECT ... FOR UPDATE}) do końca transakcji. Używamy przy każdej zmianie
     * salda: drugi równoległy spin tego samego gracza poczeka, aż pierwszy się zakończy, więc nie zdarzy się,
     * że oba odczytają saldo 100 i oba postawią po 100.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select w from Wallet w where w.player.id = :playerId")
    Optional<Wallet> findByPlayerIdForUpdate(@Param("playerId") Long playerId);

    /**
     * Ranking najwyższych sald. Projekcja wprost do rekordu ({@code select new ...}): baza zwraca tylko potrzebne
     * kolumny, a {@code join} pobiera nazwę gracza w tym samym zapytaniu (bez problemu N+1).
     * Limit wierszy przekazujemy przez {@link Pageable}.
     */
    @Query("""
            select new pl.wsb.kasyno.wallet.api.BalanceLeader(p.id, p.displayName, w.balance, w.updatedAt)
            from Wallet w join w.player p
            order by w.balance desc, w.updatedAt asc
            """)
    List<BalanceLeader> findTopBalances(Pageable pageable);

    /** Pytanie inwestora 4: ilu graczy jest „na zero” (saldo poniżej najmniejszego zakładu). */
    long countByBalanceLessThan(BigDecimal minBet);

    /** Pytanie inwestora 4: ile cebulionów jest w obiegu (suma sald). Puste, gdy nie ma portfeli. */
    @Query("select sum(w.balance) from Wallet w")
    Optional<BigDecimal> sumBalances();
}
