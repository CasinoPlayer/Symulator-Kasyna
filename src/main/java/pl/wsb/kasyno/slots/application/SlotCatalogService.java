package pl.wsb.kasyno.slots.application;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.wsb.kasyno.slots.domain.GameNotFoundException;
import pl.wsb.kasyno.slots.domain.SlotMachine;
import pl.wsb.kasyno.slots.domain.SlotMachineRepository;
import pl.wsb.kasyno.wallet.api.MinimumBetProvider;

import java.math.BigDecimal;
import java.util.List;

/**
 * Katalog automatów: lista gier do lobby, szczegóły gry z tabelą wypłat, najmniejszy zakład.
 *
 * <p>Implementuje port {@link MinimumBetProvider} z modułu portfela: portfel pyta „jaki jest najmniejszy zakład”
 * (reguła bonusu ratunkowego), nie wiedząc, że odpowiada mu moduł automatów.
 */
@Service
@Transactional(readOnly = true)
public class SlotCatalogService implements MinimumBetProvider {

    private final SlotMachineRepository machines;

    public SlotCatalogService(SlotMachineRepository machines) {
        this.machines = machines;
    }

    public List<SlotMachine> activeMachines() {
        return machines.findByActiveTrueOrderByIdAsc();
    }

    /**
     * Gra z symbolami (jedno zapytanie z {@code join fetch}).
     *
     * @throws GameNotFoundException gdy nie ma aktywnej gry o tym kodzie
     */
    public SlotMachine machineWithSymbols(String code) {
        return machines.findActiveWithSymbols(code).orElseThrow(() -> new GameNotFoundException(code));
    }

    @Override
    public BigDecimal minimumBet() {
        return machines.findLowestMinBet().orElse(BigDecimal.ZERO);
    }
}
