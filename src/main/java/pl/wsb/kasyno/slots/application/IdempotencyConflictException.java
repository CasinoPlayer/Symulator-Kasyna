package pl.wsb.kasyno.slots.application;

import pl.wsb.kasyno.shared.error.CasinoException;
import pl.wsb.kasyno.shared.error.ErrorCode;

/**
 * Ten sam {@code Idempotency-Key} przyszedł z innym ciałem żądania (inna gra albo inny zakład):
 * {@code 409 IDEMPOTENCY_CONFLICT}. Klucz identyfikuje jedno konkretne żądanie, więc nie wolno go użyć ponownie
 * dla innego spinu.
 */
public class IdempotencyConflictException extends CasinoException {

    public IdempotencyConflictException() {
        super(ErrorCode.IDEMPOTENCY_CONFLICT,
                "Ten klucz Idempotency-Key został już użyty dla innego spinu. Wygeneruj nowy klucz.");
    }
}
