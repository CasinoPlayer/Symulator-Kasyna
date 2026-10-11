package pl.wsb.kasyno.slots.application.engine;

import pl.wsb.kasyno.shared.domain.Money;

import java.math.BigDecimal;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/**
 * Fałszywy silnik gry do testów: zamiast losować, zwraca zaplanowane wygrane (domyślnie 0).
 * Prawdziwe silniki powstaną w etapie gier ({@code docs/projekt/07}); {@code SpinService} nie widzi różnicy,
 * bo zna tylko interfejs {@link SlotEngine}.
 */
public class FakeSlotEngine implements SlotEngine {

    private final String gameCode;
    private final Deque<BigDecimal> plannedWins = new ArrayDeque<>();
    private final List<SpinContext> calls = new ArrayList<>();

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
        BigDecimal win = plannedWins.isEmpty() ? BigDecimal.ZERO : plannedWins.poll();
        String json = "{\"engine\":\"fake\",\"seed\":%d,\"win\":%s}".formatted(context.seed(), win.toPlainString());
        return new SpinOutcome(win, json);
    }
}
