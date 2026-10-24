package pl.wsb.kasyno.wallet.entity;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Optional;

/**
 * Dostęp do historii portfela.
 */
public interface WalletTransactionRepository extends JpaRepository<WalletTransaction, Long> {

    /**
     * Historia operacji gracza, od najnowszej, stronicowana ({@link Pageable}: numer i rozmiar strony).
     * {@code countQuery} liczy wszystkie wiersze, żeby odpowiedź mogła podać {@code totalItems} i {@code totalPages}.
     */
    @Query(value = """
            select t from WalletTransaction t
            where t.wallet.player.id = :playerId
            order by t.createdAt desc, t.id desc
            """,
            countQuery = "select count(t) from WalletTransaction t where t.wallet.player.id = :playerId")
    Page<WalletTransaction> findPlayerHistory(@Param("playerId") Long playerId, Pageable pageable);

    /** Pytanie inwestora 4: łączna kwota danego rodzaju operacji (np. ile rozdaliśmy w bonusach ratunkowych). */
    @Query("select sum(t.amount) from WalletTransaction t where t.type = :type")
    Optional<BigDecimal> sumAmountByType(@Param("type") TransactionType type);

    long countByWalletIdAndType(Long walletId, TransactionType type);
}
