package pl.wsb.kasyno.slots.api;

/**
 * Pytanie inwestora 5: aktywność w danej godzinie doby (UTC) i średni zakład.
 * Typy pól odpowiadają temu, co zwraca JPQL: {@code extract(hour ...)} → {@code Integer},
 * {@code count} → {@code Long}, {@code avg} → {@code Double}.
 *
 * @param hour       godzina 0–23 (UTC; przeglądarka może przeliczyć na czas lokalny)
 * @param spins      liczba rund rozegranych w tej godzinie
 * @param averageBet średni zakład
 */
public record HourlyActivity(Integer hour, Long spins, Double averageBet) {
}
