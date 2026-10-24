package pl.wsb.kasyno.slots.application;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import pl.wsb.kasyno.account.application.LoginService;
import pl.wsb.kasyno.shared.domain.Money;
import pl.wsb.kasyno.slots.entity.SpinRoundRepository;
import pl.wsb.kasyno.support.MutableClock;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Zadanie „zapomnij klucze idempotencji starsze niż doba” na prawdziwej bazie H2, z zegarem testowym: przesuwamy czas
 * o 25 godzin i wołamy zadanie wprost (harmonogram jest w testach wyłączony), bez czekania.
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(IdempotencyKeyCleanupTest.TestClock.class)
@DisplayName("LAB 06: zapominanie starych kluczy Idempotency-Key (@Scheduled) z zegarem testowym")
class IdempotencyKeyCleanupTest {

    private static final Instant START = Instant.parse("2026-10-11T12:00:00Z");

    @TestConfiguration
    static class TestClock {

        @Bean
        @Primary
        MutableClock testClock() {
            return new MutableClock(START);
        }
    }

    @Autowired
    private MutableClock clock;
    @Autowired
    private LoginService loginService;
    @Autowired
    private SpinService spinService;
    @Autowired
    private IdempotencyKeyCleanup cleanup;
    @Autowired
    private SpinRoundRepository rounds;

    private SpinResult spin(Long playerId, String key) {
        return spinService.spin(new SpinCommand(playerId, "cebulowy-777", Money.of(10), key));
    }

    @Test
    @DisplayName("klucz sprzed 25 h znika, wczorajsza runda zostaje; świeży klucz dalej daje powtórkę")
    void forgetsOnlyExpiredKeys() {
        clock.set(START);
        Long playerId = loginService.login("Klucz_Stary").playerId();
        SpinResult old = spin(playerId, "klucz-wczorajszy");

        clock.advance(Duration.ofHours(25));
        SpinResult fresh = spin(playerId, "klucz-dzisiejszy");

        int cleared = cleanup.forgetExpiredKeys();

        assertThat(cleared).isGreaterThanOrEqualTo(1);
        assertThat(rounds.findById(old.roundId())).get()
                .satisfies(round -> {
                    assertThat(round.getIdempotencyKey()).isNull();
                    assertThat(round.getResultJson()).isNotBlank();
                });
        assertThat(rounds.findById(fresh.roundId())).get()
                .satisfies(round -> assertThat(round.getIdempotencyKey()).isEqualTo("klucz-dzisiejszy"));

        // świeży klucz: nadal powtórka tej samej rundy
        SpinResult replay = spin(playerId, "klucz-dzisiejszy");
        assertThat(replay.replayed()).isTrue();
        assertThat(replay.roundId()).isEqualTo(fresh.roundId());
        // zapomniany klucz: po dobie to już nowa runda (okno idempotencji = kasyno.schedule.idempotency-key-ttl)
        SpinResult afterWindow = spin(playerId, "klucz-wczorajszy");
        assertThat(afterWindow.replayed()).isFalse();
        assertThat(afterWindow.roundId()).isNotEqualTo(old.roundId());
    }

    @Test
    @DisplayName("klucz młodszy niż doba zostaje, a drugie uruchomienie niczego już nie zmienia")
    void keepsFreshKeysAndIsIdempotent() {
        clock.set(START.plus(Duration.ofDays(10)));
        Long playerId = loginService.login("Klucz_Swiezy").playerId();
        SpinResult round = spin(playerId, "klucz-z-rana");

        clock.advance(Duration.ofHours(23));
        cleanup.forgetExpiredKeys();
        assertThat(rounds.findById(round.roundId())).get()
                .satisfies(r -> assertThat(r.getIdempotencyKey()).isEqualTo("klucz-z-rana"));

        clock.advance(Duration.ofHours(2));
        assertThat(cleanup.forgetExpiredKeys()).isGreaterThanOrEqualTo(1);
        assertThat(cleanup.forgetExpiredKeys()).isZero();
    }
}
