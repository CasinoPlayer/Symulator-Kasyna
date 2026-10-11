package pl.wsb.kasyno.slots.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import pl.wsb.kasyno.shared.config.CasinoProperties;
import pl.wsb.kasyno.slots.domain.SpinRoundRepository;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/**
 * Zadanie cykliczne (LAB 06): zapomina klucze {@code Idempotency-Key} spinów starsze niż doba.
 *
 * <p>Po co jest klucz: chroni przed podwójnym kliknięciem „SPIN” i przed ponowieniem żądania po zerwanym połączeniu.
 * Takie powtórki przychodzą w ciągu sekund, najwyżej minut. Klucz z wczorajszej rundy nikomu już nie jest potrzebny,
 * a każdy zajmuje miejsce w unikalnym indeksie {@code (user_id, idempotency_key)}, który baza sprawdza przy każdym
 * spinie. Tak samo działają API płatności (np. Stripe pamięta klucze idempotencji przez 24 godziny).
 *
 * <p>Co się zmienia w bazie: tylko kolumna {@code spin_round.idempotency_key} starych rund dostaje {@code NULL}.
 * Rundy, ich wynik ({@code result_json}), saldo i statystyki zostają bez zmian. Skutek dla gracza: gdyby po dobie
 * przyszło żądanie z tym samym kluczem, będzie to nowa runda, a nie powtórka (opisane w kontrakcie jako okno
 * idempotencji).
 *
 * <p>Harmonogram: {@code kasyno.schedule.idempotency-cleanup-cron} (domyślnie co godzinę, w 30. minucie, UTC),
 * czas życia klucza: {@code kasyno.schedule.idempotency-key-ttl} (domyślnie 24 h). Czas „teraz” bierzemy z
 * {@link Clock}, więc test przesuwa zegar o 25 godzin i woła {@link #forgetExpiredKeys()} wprost, bez czekania.
 */
@Component
public class IdempotencyKeyCleanup {

    private static final Logger log = LoggerFactory.getLogger(IdempotencyKeyCleanup.class);

    private final SpinRoundRepository rounds;
    private final CasinoProperties properties;
    private final Clock clock;

    public IdempotencyKeyCleanup(SpinRoundRepository rounds, CasinoProperties properties, Clock clock) {
        this.rounds = rounds;
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * Usuwa klucze idempotencji rund rozpoczętych wcześniej niż {@code teraz − idempotency-key-ttl}.
     * Jedna krótka transakcja z jednym {@code UPDATE}; spiny w toku nie są dotknięte, bo ich rundy są świeże.
     *
     * @return liczba rund, którym usunięto klucz
     */
    @Scheduled(cron = "${kasyno.schedule.idempotency-cleanup-cron:0 30 * * * *}", zone = "UTC")
    @Transactional
    public int forgetExpiredKeys() {
        Duration ttl = properties.schedule().idempotencyKeyTtl();
        Instant before = clock.instant().minus(ttl);
        int cleared = rounds.clearIdempotencyKeysCreatedBefore(before);
        if (cleared > 0) {
            log.info("idempotency_cleanup cleared={} before={} ttl={}", cleared, before, ttl);
        } else {
            log.debug("idempotency_cleanup cleared=0 before={}", before);
        }
        return cleared;
    }
}
