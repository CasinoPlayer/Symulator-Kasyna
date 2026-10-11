package pl.wsb.kasyno.slots.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * Dostęp do katalogu automatów.
 */
public interface SlotMachineRepository extends JpaRepository<SlotMachine, Long> {

    /** Lista gier do lobby, w kolejności dodania. Bez symboli (kolekcja LAZY nie jest ładowana). */
    List<SlotMachine> findByActiveTrueOrderByIdAsc();

    Optional<SlotMachine> findByCodeAndActiveTrue(String code);

    /**
     * Automat razem z symbolami w jednym zapytaniu ({@code left join fetch}). Bez {@code fetch} odczyt
     * {@code machine.getSymbols()} wykonałby drugie zapytanie, a przy wyłączonym {@code open-in-view}
     * poza transakcją skończyłby się błędem {@code LazyInitializationException}.
     */
    @Query("select distinct m from SlotMachine m left join fetch m.symbols where m.code = :code and m.active = true")
    Optional<SlotMachine> findActiveWithSymbols(@Param("code") String code);

    /** Najmniejszy zakład spośród aktywnych gier (puste, gdy nie ma żadnej aktywnej gry). */
    @Query("select min(m.minBet) from SlotMachine m where m.active = true")
    Optional<BigDecimal> findLowestMinBet();
}
