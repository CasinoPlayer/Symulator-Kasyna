package pl.wsb.kasyno.slots.repository;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import pl.wsb.kasyno.slots.entity.Payouts;
import pl.wsb.kasyno.slots.entity.SlotMachine;
import pl.wsb.kasyno.slots.entity.SlotSymbol;
import pl.wsb.kasyno.slots.entity.SymbolKind;
import pl.wsb.kasyno.support.TestData;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * LAB 03: zapytanie pochodne przez relację {@code @ManyToOne} ({@code findBySlotMachine_Code…}) na prawdziwej bazie H2.
 */
@DataJpaTest(showSql = false)
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.sql.init.mode=never")
@DisplayName("SlotSymbolRepository: zapytanie przez relację slotMachine")
class SlotSymbolRepositoryTest {

    @Autowired
    private TestEntityManager em;
    @Autowired
    private SlotSymbolRepository symbols;

    @Test
    @DisplayName("findBySlotMachine_Code zwraca tylko symbole automatu o podanym kodzie, w kolejności sort_order")
    void findsSymbolsThroughRelation() {
        SlotMachine cebulowy = em.persist(TestData.cebulowy777());
        SlotMachine kaskada = em.persist(TestData.kaskada());
        em.persist(new SlotSymbol(cebulowy, "siodemka", SymbolKind.NORMAL, 3, Payouts.parse("3:50"), 2));
        em.persist(new SlotSymbol(cebulowy, "cebula", SymbolKind.NORMAL, 10, Payouts.parse("3:5"), 1));
        em.persist(new SlotSymbol(kaskada, "krysztal", SymbolKind.NORMAL, 8, null, 1));
        em.flush();
        em.clear();

        List<SlotSymbol> found = symbols.findBySlotMachine_CodeOrderBySortOrderAsc("cebulowy-777");

        assertThat(found).extracting(SlotSymbol::getCode).containsExactly("cebula", "siodemka");
        assertThat(symbols.findBySlotMachine_CodeOrderBySortOrderAsc("nie-ma-takiej-gry")).isEmpty();
    }
}
