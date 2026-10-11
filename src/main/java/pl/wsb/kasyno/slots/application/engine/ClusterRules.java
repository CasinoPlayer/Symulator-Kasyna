package pl.wsb.kasyno.slots.application.engine;

import java.util.List;

/**
 * Zasady gry klastrowej (Kryształowa Kaskada): minimalny klaster, darmowe spiny, kule mnożników, limit wygranej.
 * Dane „tabelaryczne” (symbole, wagi losowania, wypłaty za rozmiar klastra) są w {@code data.sql}.
 *
 * <p>Rozkład wartości kul trzymamy tutaj, a nie w {@code slot_symbol.pays}, bo to nie są wypłaty: kolumna
 * {@code pays} trafia do tabeli wypłat na ekranie informacyjnym, a wartości kul to osobny rozkład losowania.
 *
 * @param minClusterSize   najmniejszy płacący klaster (5 pól połączonych bokami)
 * @param freeSpins        zasady darmowych spinów
 * @param orbValues        możliwe wartości kul mnożników z wagami (im większa wartość, tym mniejsza waga)
 * @param maxWinMultiplier maksymalna wygrana rundy jako wielokrotność zakładu
 */
public record ClusterRules(int minClusterSize, FreeSpinsRules freeSpins, List<OrbValue> orbValues,
                           int maxWinMultiplier) {

    public ClusterRules {
        if (minClusterSize < 2 || freeSpins == null || orbValues == null || orbValues.isEmpty() || maxWinMultiplier < 1) {
            throw new IllegalArgumentException("Niepoprawne zasady gry klastrowej");
        }
        orbValues = List.copyOf(orbValues);
    }

    /** Wartość kuli mnożnika ({@code ×value}) i jej waga losowania. */
    public record OrbValue(int value, int weight) {

        public OrbValue {
            if (value < 2 || weight <= 0) {
                throw new IllegalArgumentException("Kula mnożnika: wartość ≥ 2 i dodatnia waga");
            }
        }
    }
}
