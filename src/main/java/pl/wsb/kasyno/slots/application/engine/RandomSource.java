package pl.wsb.kasyno.slots.application.engine;

/**
 * Źródło liczb losowych <b>wewnątrz jednej rundy</b>. Silniki gier losują wyłącznie przez ten interfejs.
 *
 * <p>Po co interfejs zamiast {@code new Random()} w silniku:
 * <ul>
 *   <li>w aplikacji runda dostaje {@link SplittableRandomSource} zbudowany z ziarna rundy, więc ten sam seed
 *       zawsze daje ten sam przebieg (odtwarzalność, audyt, testy);</li>
 *   <li>w testach można podać „ustawione” liczby (np. pozycje zatrzymania bębnów) i sprawdzić konkretny układ:
 *       WILD na linii, klaster 5 pól, rozszerzenie WILD w darmowych spinach.</li>
 * </ul>
 * Ziarno rundy pochodzi z {@link SeedGenerator} ({@link java.security.SecureRandom}, 64 bity): jest nieprzewidywalne
 * dla gracza, a mimo to po fakcie pozwala odtworzyć rundę.
 */
@FunctionalInterface
public interface RandomSource {

    /** Liczba losowa z przedziału {@code [0, bound)}, każda wartość z tym samym prawdopodobieństwem. */
    int nextInt(int bound);

    /** Generator rundy dla podanego ziarna (to samo ziarno → te same liczby). */
    static RandomSource fromSeed(long seed) {
        return new SplittableRandomSource(seed);
    }
}
