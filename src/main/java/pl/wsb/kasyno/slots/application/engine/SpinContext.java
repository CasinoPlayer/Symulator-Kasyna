package pl.wsb.kasyno.slots.application.engine;

import pl.wsb.kasyno.slots.entity.SlotMachine;

import java.math.BigDecimal;

/**
 * Dane wejściowe silnika gry dla jednej rundy.
 *
 * @param machine konfiguracja automatu (siatka, linie, symbole i wypłaty)
 * @param bet     zakład (już zweryfikowany: jest na liście {@code betLevels})
 * @param seed    ziarno generatora liczb losowych tej rundy (zapisywane w {@code spin_round.seed})
 */
public record SpinContext(SlotMachine machine, BigDecimal bet, long seed) {
}
