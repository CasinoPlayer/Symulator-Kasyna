package pl.wsb.kasyno.slots.application.engine;

import java.math.BigDecimal;

/**
 * Wspólna część silników gier: wczytanie matematyki gry, utworzenie generatora rundy z ziarna, zamiana wyniku
 * na JSON (wzorzec „metoda szablonowa”: szkielet {@link #play} jest tutaj, a samą rundę liczy
 * {@link #playRound} w {@link LinesEngine} albo {@link ClusterEngine}).
 *
 * <p>Metoda {@link #playRound} jest publiczna i nie dotyka bazy ani Springa: testy matematyki wołają ją miliony razy
 * z gotowym {@link GameMath} i własnym {@link RandomSource}.
 */
public abstract class ConfiguredSlotEngine implements SlotEngine {

    private final String gameCode;
    private final GameMathProvider mathProvider;

    protected ConfiguredSlotEngine(String gameCode, GameMathProvider mathProvider) {
        this.gameCode = gameCode;
        this.mathProvider = mathProvider;
    }

    @Override
    public String gameCode() {
        return gameCode;
    }

    /**
     * Runda dla zakładu i ziarna z kontekstu. Zakład jest liczbą całkowitą cebulionów (poziomy z {@code betLevels}),
     * więc {@code longValueExact()} nigdy nie traci groszy; gdyby ktoś dodał ułamkowy poziom, dostanie wyjątek
     * zamiast cichego zaokrąglenia.
     */
    @Override
    public final SpinOutcome play(SpinContext context) {
        GameMath math = mathProvider.mathFor(context.machine());
        long bet = context.bet().longValueExact();
        RoundResult result = playRound(math, bet, RandomSource.fromSeed(context.seed()));
        return new SpinOutcome(BigDecimal.valueOf(result.totalWin()), RoundJson.stepsDocument(result.steps()));
    }

    /**
     * Liczy całą rundę: obrót, wygrane, funkcje specjalne i darmowe spiny.
     *
     * @param math   matematyka gry
     * @param bet    zakład całkowity w cebulionach
     * @param random generator rundy (w aplikacji: z ziarna rundy)
     */
    public abstract RoundResult playRound(GameMath math, long bet, RandomSource random);
}
