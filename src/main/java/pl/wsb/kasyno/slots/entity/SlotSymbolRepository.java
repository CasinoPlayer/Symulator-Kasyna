package pl.wsb.kasyno.slots.entity;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Dostęp do symboli automatów (tabele wypłat). Silniki gier wczytają z niej konfigurację bębnów.
 */
public interface SlotSymbolRepository extends JpaRepository<SlotSymbol, Long> {

    List<SlotSymbol> findBySlotMachineIdOrderBySortOrderAsc(Long slotMachineId);
}
