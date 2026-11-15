package pl.wsb.kasyno.slots.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pl.wsb.kasyno.slots.entity.SlotSymbol;

import java.util.List;

/**
 * Dostęp do symboli automatów (tabele wypłat). Silniki gier wczytają z niej konfigurację bębnów.
 */
public interface SlotSymbolRepository extends JpaRepository<SlotSymbol, Long> {

    List<SlotSymbol> findBySlotMachineIdOrderBySortOrderAsc(Long slotMachineId);

    /**
     * LAB 03 (R3.12): zapytanie pochodne przez relację {@code SlotSymbol.slotMachine} ({@code @ManyToOne}).
     * {@code SlotMachine_Code} = pole relacji {@code slotMachine}, a w encji nadrzędnej pole {@code code}.
     * Spring Data buduje z nazwy metody SQL z joinem:
     * {@code select s.* from slot_symbol s join slot_machine m on m.id = s.slot_machine_id
     * where m.code = ? order by s.sort_order}.
     */
    List<SlotSymbol> findBySlotMachine_CodeOrderBySortOrderAsc(String code);
}
