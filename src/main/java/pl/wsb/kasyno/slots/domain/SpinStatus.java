package pl.wsb.kasyno.slots.domain;

import java.util.EnumSet;
import java.util.Set;

/**
 * Status rundy gry (cykl życia obiektu, wymaganie koncepcji projektu).
 *
 * <pre>
 * STARTED ──► RESOLVED ──► SETTLED
 *    │            │
 *    └──► FAILED ◄┘
 * </pre>
 *
 * <ul>
 *   <li>{@code STARTED}: zakład przyjęty, saldo pomniejszone;</li>
 *   <li>{@code RESOLVED}: silnik gry wylosował wynik;</li>
 *   <li>{@code SETTLED}: wygrana zaksięgowana w portfelu (stan końcowy);</li>
 *   <li>{@code FAILED}: runda przerwana (stan końcowy).</li>
 * </ul>
 * Dozwolone przejścia są zapisane tutaj, w jednym miejscu; pilnuje ich encja {@link SpinRound}.
 */
public enum SpinStatus {

    STARTED,
    RESOLVED,
    SETTLED,
    FAILED;

    /** Czy z tego statusu wolno przejść do {@code target}. */
    public boolean canTransitionTo(SpinStatus target) {
        return allowedTargets().contains(target);
    }

    public boolean isFinal() {
        return allowedTargets().isEmpty();
    }

    private Set<SpinStatus> allowedTargets() {
        return switch (this) {
            case STARTED -> EnumSet.of(RESOLVED, FAILED);
            case RESOLVED -> EnumSet.of(SETTLED, FAILED);
            case SETTLED, FAILED -> EnumSet.noneOf(SpinStatus.class);
        };
    }
}
