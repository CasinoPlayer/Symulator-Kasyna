package pl.wsb.kasyno.slots.application;

import pl.wsb.kasyno.slots.application.engine.SlotEnginesConfig;

import java.util.List;

/**
 * Powtarzalne scenariusze prezentacji, odtwarzane przez zwykły spin i X-Demo-Seed.
 * Seedy dobrano z rzeczywistego silnika i data.sql; SlotDebugScenariosTest sprawdza ich znaczenie
 * na wszystkich stawkach. Po zmianie matematyki trzeba ponownie dobrać te, których test przestał przechodzić.
 * Udostępnienie katalogu i przyjęcie seeda wymagają jawnej flagi kasyno.demo.allow-seed=true.
 */
public final class SlotDebugScenarios {

    private SlotDebugScenarios() {
    }

    public record Scenario(String id, String label, String seed) {
    }

    public static List<Scenario> forGame(String code) {
        return switch (code) {
            case SlotEnginesConfig.CEBULOWY_777 -> List.of(
                    new Scenario("wild-win", "WILD + WYGRANA", "0000000000000000"));
            case SlotEnginesConfig.ZLOTY_FARAON -> List.of(
                    new Scenario("scatter", "SCATTER", "0000000000000003"),
                    new Scenario("bonus", "BONUS", "0000000000000035"));
            case SlotEnginesConfig.KRYSZTALOWA_KASKADA -> List.of(
                    new Scenario("scatter", "SCATTER", "0000000000000000"),
                    new Scenario("bonus", "BONUS", "0000000000000134"),
                    new Scenario("cascade", "KASKADA", "0000000000000009"));
            default -> List.of();
        };
    }
}
