package pl.wsb.kasyno.slots.application.engine;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Rejestr silników gier: kod gry → silnik.
 *
 * <p>Spring przekazuje tu wszystkie beany typu {@link SlotEngine}. Dodanie nowej gry nie wymaga zmian w tej klasie
 * ani w {@code SpinService}: wystarczy nowy {@code @Component implements SlotEngine} (zasada otwarte–zamknięte).
 * {@link ObjectProvider} zamiast {@code List}: aplikacja startuje także wtedy, gdy nie ma jeszcze żadnego silnika.
 * Dwa silniki z tym samym kodem gry to błąd konfiguracji, więc zatrzymujemy start aplikacji.
 */
@Component
public class SlotEngineRegistry {

    private final Map<String, SlotEngine> enginesByGameCode;

    public SlotEngineRegistry(ObjectProvider<SlotEngine> engines) {
        this.enginesByGameCode = engines.orderedStream()
                .collect(Collectors.toUnmodifiableMap(SlotEngine::gameCode, Function.identity(), (first, second) -> {
                    throw new IllegalStateException("Dwa silniki dla gry " + first.gameCode() + ": "
                            + first.getClass().getSimpleName() + " i " + second.getClass().getSimpleName());
                }));
    }

    public Optional<SlotEngine> find(String gameCode) {
        return Optional.ofNullable(enginesByGameCode.get(gameCode));
    }

    /** Kody gier, które mają silnik (np. do oznaczenia w lobby, które gry są już grywalne). */
    public Set<String> supportedGames() {
        return enginesByGameCode.keySet();
    }
}
