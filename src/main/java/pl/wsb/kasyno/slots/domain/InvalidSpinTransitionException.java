package pl.wsb.kasyno.slots.domain;

import pl.wsb.kasyno.shared.error.CasinoException;
import pl.wsb.kasyno.shared.error.ErrorCode;

/**
 * Próba niedozwolonej zmiany statusu rundy, np. rozliczenie rundy, która już jest rozliczona ({@code SETTLED →
 * SETTLED}) albo pominięcie losowania ({@code STARTED → SETTLED}). To zawsze błąd w kodzie, a nie w danych od
 * gracza, więc klient dostaje {@code 500 INTERNAL_ERROR} bez szczegółów, a transakcja (z zakładem) się wycofuje.
 */
public class InvalidSpinTransitionException extends CasinoException {

    public InvalidSpinTransitionException(Long roundId, SpinStatus from, SpinStatus to) {
        super(ErrorCode.INTERNAL_ERROR, "Runda %s: niedozwolone przejście %s → %s".formatted(roundId, from, to));
    }
}
