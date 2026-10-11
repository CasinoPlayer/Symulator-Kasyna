package pl.wsb.kasyno.report.application;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import pl.wsb.kasyno.report.application.LobbyBoardsCache.Board;
import pl.wsb.kasyno.shared.config.CasinoProperties;
import pl.wsb.kasyno.support.MutableClock;
import pl.wsb.kasyno.support.TestData;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pamięć podręczna feedu i rankingów: trafienie, unieważnienie zdarzeniem, wygasanie (zegar testowy) i ochrona przed
 * zapamiętaniem wyniku zapytania, w trakcie którego dane się zmieniły.
 */
@DisplayName("LobbyBoardsCache: pamięć podręczna feedu i rankingu")
class LobbyBoardsCacheTest {

    private final MutableClock clock = new MutableClock(Instant.parse("2026-10-11T12:00:00Z"));
    private final LobbyBoardsCache cache = new LobbyBoardsCache(TestData.properties(), clock);
    private final AtomicInteger queries = new AtomicInteger();

    private List<String> load(String... rows) {
        queries.incrementAndGet();
        return List.of(rows);
    }

    @Test
    @DisplayName("drugi odczyt bez zmian w danych nie pyta bazy")
    void hit() {
        assertThat(cache.get(Board.BIG_WINS, 8, () -> load("a"))).containsExactly("a");
        assertThat(cache.get(Board.BIG_WINS, 8, () -> load("b"))).containsExactly("a");
        assertThat(queries).hasValue(1);
    }

    @Test
    @DisplayName("unieważnienie tablicy (zdarzenie po commicie) wymusza nowe zapytanie, inne tablice zostają")
    void invalidate() {
        cache.get(Board.BIG_WINS, 8, () -> load("stary"));
        cache.get(Board.BALANCE, 10, () -> load("saldo"));

        cache.invalidate(Board.BIG_WINS);

        assertThat(cache.get(Board.BIG_WINS, 8, () -> load("nowy"))).containsExactly("nowy");
        assertThat(cache.get(Board.BALANCE, 10, () -> load("inne"))).containsExactly("saldo");
        assertThat(cache.generation(Board.BIG_WINS)).isEqualTo(1);
        assertThat(cache.generation(Board.BALANCE)).isZero();
    }

    @Test
    @DisplayName("różne limity to różne wpisy")
    void limitIsPartOfKey() {
        cache.get(Board.BIGGEST_WIN, 3, () -> load("1", "2", "3"));
        assertThat(cache.get(Board.BIGGEST_WIN, 10, () -> load("1", "2", "3", "4"))).hasSize(4);
        assertThat(queries).hasValue(2);
    }

    @Test
    @DisplayName("pas bezpieczeństwa: wpis wygasa po kasyno.lobby.cache-ttl (30 s) bez żadnego zdarzenia")
    void ttl() {
        cache.get(Board.BALANCE, 10, () -> load("rano"));
        clock.advance(Duration.ofSeconds(29));
        assertThat(cache.get(Board.BALANCE, 10, () -> load("x"))).containsExactly("rano");
        clock.advance(Duration.ofSeconds(1));
        assertThat(cache.get(Board.BALANCE, 10, () -> load("po 30 s"))).containsExactly("po 30 s");
    }

    @Test
    @DisplayName("zmiana danych W TRAKCIE zapytania: wynik trafia do odpowiedzi, ale nie do pamięci")
    void invalidationDuringQueryIsNotCached() {
        List<String> first = cache.get(Board.BIG_WINS, 8, () -> {
            // ktoś zatwierdził spin z dużą wygraną, kiedy to zapytanie jeszcze trwało (mogło widzieć stary stan)
            cache.invalidate(Board.BIG_WINS);
            return load("może-nieaktualny");
        });

        assertThat(first).containsExactly("może-nieaktualny");
        assertThat(cache.get(Board.BIG_WINS, 8, () -> load("aktualny"))).containsExactly("aktualny");
        assertThat(queries).hasValue(2);
    }

    @Test
    @DisplayName("cache-ttl=0s wyłącza pamięć podręczną (każdy odczyt to zapytanie)")
    void disabled() {
        CasinoProperties base = TestData.properties();
        CasinoProperties noCache = new CasinoProperties(base.welcomeBonus(), base.rescueAmount(), base.rescueCooldown(),
                base.bigWinMultiplier(), base.nick(), new CasinoProperties.Lobby(Duration.ZERO), base.schedule(),
                base.demo(), base.starterData());
        LobbyBoardsCache off = new LobbyBoardsCache(noCache, clock);

        off.get(Board.BIG_WINS, 8, () -> load("a"));
        off.get(Board.BIG_WINS, 8, () -> load("a"));

        assertThat(queries).hasValue(2);
    }
}
