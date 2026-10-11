package pl.wsb.kasyno.slots.web;

import pl.wsb.kasyno.slots.application.SlotDebugScenarios;

import java.util.List;

/** Katalog scenariuszy dostępny tylko przy jawnie włączonej fladze kasyno.demo.allow-seed. */
public record SlotDebugResponse(boolean enabled, List<SlotDebugScenarios.Scenario> scenarios) {
    public SlotDebugResponse {
        scenarios = List.copyOf(scenarios);
    }
}
