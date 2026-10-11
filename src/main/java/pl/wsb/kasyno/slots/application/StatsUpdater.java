package pl.wsb.kasyno.slots.application;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import pl.wsb.kasyno.account.domain.UserAccountRepository;
import pl.wsb.kasyno.slots.api.SpinCompleted;
import pl.wsb.kasyno.slots.domain.PlayerMachineStats;
import pl.wsb.kasyno.slots.domain.PlayerMachineStatsRepository;
import pl.wsb.kasyno.slots.domain.SlotMachineRepository;

/**
 * Po każdej rozliczonej rundzie dolicza statystyki gracza na automacie ({@link PlayerMachineStats}).
 *
 * <p>{@code @EventListener} jest synchroniczny: metoda wykonuje się w środku {@code publishEvent(...)}, w tej samej
 * transakcji co spin. Gdyby zapis statystyk się nie udał, wycofa się cały spin, więc statystyki nigdy nie
 * rozjadą się z rundami. {@code Propagation.MANDATORY} pilnuje tego założenia: wywołanie bez trwającej transakcji
 * kończy się błędem, zamiast po cichu zapisać statystyki osobno.
 *
 * <p>Równoległe spiny tego samego gracza są szeregowane blokadą portfela ({@code SELECT ... FOR UPDATE} przy
 * pobraniu zakładu), więc dwa wątki nie utworzą jednocześnie dwóch wierszy statystyk dla tej samej pary.
 */
@Component
public class StatsUpdater {

    private final PlayerMachineStatsRepository stats;
    private final UserAccountRepository accounts;
    private final SlotMachineRepository machines;

    public StatsUpdater(PlayerMachineStatsRepository stats, UserAccountRepository accounts,
                        SlotMachineRepository machines) {
        this.stats = stats;
        this.accounts = accounts;
        this.machines = machines;
    }

    @EventListener
    @Transactional(propagation = Propagation.MANDATORY)
    public void onSpinCompleted(SpinCompleted event) {
        PlayerMachineStats playerStats = stats.findByPlayerIdAndSlotMachineId(event.playerId(), event.slotMachineId())
                // getReferenceById nie czyta wiersza z bazy, tylko tworzy „wskaźnik” do encji o tym id
                .orElseGet(() -> stats.save(new PlayerMachineStats(
                        accounts.getReferenceById(event.playerId()),
                        machines.getReferenceById(event.slotMachineId()))));
        playerStats.record(event.bet(), event.win(), event.at());
    }
}
