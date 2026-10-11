package pl.wsb.kasyno.slots.application.engine;

import org.springframework.stereotype.Component;
import pl.wsb.kasyno.slots.domain.SlotMachine;
import pl.wsb.kasyno.slots.domain.SlotSymbolRepository;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Wczytuje matematykę gry z bazy ({@code slot_machine} + {@code slot_symbol}) i trzyma ją w pamięci podręcznej.
 *
 * <p>Konfiguracja gier pochodzi z {@code data.sql} i nie zmienia się w trakcie działania aplikacji, więc wczytujemy
 * ją <b>raz na grę</b> (przy pierwszym spinie) i dalej korzystamy z gotowego {@link GameMath}. Bez tego każdy spin
 * wykonywałby dodatkowe zapytanie o symbole i od nowa parsował taśmy bębnów.
 *
 * <p>Pamięć podręczna to zwykła {@link ConcurrentHashMap#computeIfAbsent}: bezpieczna wątkowo i wystarczająca dla
 * trzech gier (bez dodatkowej biblioteki i konfiguracji {@code @EnableCaching}). Zmiana matematyki = zmiana
 * {@code data.sql} i restart aplikacji (przy {@code create-drop} i tak baza powstaje od nowa).
 */
@Component
public class GameMathProvider {

    private final SlotSymbolRepository symbols;
    private final Map<String, GameMath> cache = new ConcurrentHashMap<>();

    public GameMathProvider(SlotSymbolRepository symbols) {
        this.symbols = symbols;
    }

    /** Matematyka gry tego automatu (z pamięci podręcznej albo wczytana z bazy). */
    public GameMath mathFor(SlotMachine machine) {
        return cache.computeIfAbsent(machine.getCode(),
                code -> GameMath.of(machine, symbols.findBySlotMachineIdOrderBySortOrderAsc(machine.getId())));
    }
}
