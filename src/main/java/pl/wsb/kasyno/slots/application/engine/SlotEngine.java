package pl.wsb.kasyno.slots.application.engine;

/**
 * Silnik jednej gry: na podstawie zakładu i ziarna losowania liczy pełny wynik rundy.
 *
 * <p>Kontrakt dla implementacji (Cebulowy 777, Złoty Faraon, Kryształowa Kaskada; etap opisany
 * w {@code docs/projekt/07-gry-i-matematyka.md}):
 * <ul>
 *   <li>wynik zależy <b>wyłącznie</b> od {@link SpinContext} (ten sam seed → ten sam wynik), więc rundę można
 *       odtworzyć i przetestować; silnik nie losuje „sam z siebie” i nie czyta zegara;</li>
 *   <li>silnik niczego nie zapisuje i nie zna portfela: saldo i zapis rundy obsługuje {@code SpinService};</li>
 *   <li>cała sekwencja (obrót, kaskady, darmowe spiny) jest liczona od razu i zwracana jako JSON z krokami animacji.</li>
 * </ul>
 *
 * <p>Implementacja to bean Springa ({@code @Component}); {@link SlotEngineRegistry} znajdzie ją sam po
 * {@link #gameCode()}. Dopóki gra nie ma silnika, spin zwraca {@code 503 GAME_NOT_READY}.
 */
public interface SlotEngine {

    /** Kod gry obsługiwanej przez silnik, np. {@code cebulowy-777}. */
    String gameCode();

    /** Liczy wynik rundy. */
    SpinOutcome play(SpinContext context);
}
