package pl.wsb.kasyno.slots.application.engine;

import pl.wsb.kasyno.shared.domain.Money;

import java.math.BigDecimal;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Fałszywy silnik gry do testów: zamiast losować, zwraca zaplanowane wygrane (domyślnie 0).
 * Prawdziwe silniki powstaną w etapie gier ({@code docs/projekt/07}); {@code SpinService} nie widzi różnicy,
 * bo zna tylko interfejs {@link SlotEngine}.
 *
 * <p>Kolekcje są bezpieczne wątkowo, bo testy współbieżności wołają silnik z wielu wątków naraz.
 */
public class FakeSlotEngine implements SlotEngine {

    private final String gameCode;
    private final Queue<BigDecimal> plannedWins = new ConcurrentLinkedQueue<>();
    private final List<SpinContext> calls = new CopyOnWriteArrayList<>();

    public FakeSlotEngine(String gameCode) {
        this.gameCode = gameCode;
    }

    /** Kolejne wywołania {@link #play} zwrócą te wygrane (w cebulionach), potem już 0. */
    public FakeSlotEngine willWin(long... wins) {
        for (long win : wins) {
            plannedWins.add(Money.of(win));
        }
        return this;
    }

    public List<SpinContext> calls() {
        return calls;
    }

    public void reset() {
        plannedWins.clear();
        calls.clear();
    }

    @Override
    public String gameCode() {
        return gameCode;
    }

    @Override
    public SpinOutcome play(SpinContext context) {
        calls.add(context);
        BigDecimal planned = plannedWins.poll();
        BigDecimal win = planned == null ? BigDecimal.ZERO : planned;
        String json = "{\"engine\":\"fake\",\"seed\":%d,\"win\":%s}".formatted(context.seed(), win.toPlainString());
        return new SpinOutcome(win, json);
    }
}
