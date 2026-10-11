package pl.wsb.kasyno.report.application;

import org.springframework.stereotype.Component;
import pl.wsb.kasyno.shared.config.CasinoProperties;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;

/**
 * Pamięć podręczna (cache) feedu dużych wygranych i rankingów w lobby.
 *
 * <p>Po co: każda otwarta karta lobby co 45 sekund pyta o feed i ranking, a dane zmieniają się tylko wtedy, gdy ktoś
 * zagra. Dalej liczymy je zapytaniami (jedno źródło prawdy: baza), ale wynik zapamiętujemy i oddajemy z pamięci,
 * dopóki nic się nie zmieniło. Przy trafieniu w cache żądanie w ogóle nie bierze połączenia z bazy.
 *
 * <p>Kiedy wpis przestaje być aktualny, mówi {@link LobbyBoardsListener}: po <b>zatwierdzeniu</b> transakcji spinu
 * albo zmiany salda woła {@link #invalidate(Board)}. Każda tablica ma licznik pokoleń ({@code generation}):
 * unieważnienie to zwiększenie licznika o 1, a wpis z innym numerem pokolenia jest traktowany jak brak wpisu.
 *
 * <p>Dlaczego licznik, a nie zwykłe {@code map.clear()}: zapytanie trwa chwilę. Gdyby w trakcie zapytania ktoś
 * zatwierdził spin i wyczyścił mapę, to zapytanie (które mogło jeszcze widzieć stary stan bazy) wpisałoby do pamięci
 * nieaktualny wynik zaraz po czyszczeniu. Dlatego numer pokolenia odczytujemy <i>przed</i> zapytaniem i zapisujemy
 * wynik tylko wtedy, gdy po zapytaniu numer jest ten sam. To działa wyłącznie dlatego, że unieważnienie przychodzi
 * <i>po</i> zatwierdzeniu transakcji ({@code AFTER_COMMIT}): każde zapytanie rozpoczęte po zwiększeniu licznika
 * widzi już nowe dane. Unieważnienie wewnątrz transakcji (przed commitem) pozwoliłoby zapisać stary wynik
 * z nowym numerem pokolenia i pokazywać go aż do wygaśnięcia.
 *
 * <p>Pas bezpieczeństwa: wpis żyje najwyżej {@code kasyno.lobby.cache-ttl} (domyślnie 30 s), na wypadek zmiany danych
 * z pominięciem aplikacji (np. poprawka w konsoli H2). {@code 0s} wyłącza pamięć podręczną. Czas z {@link Clock},
 * więc wygasanie sprawdza test bez czekania.
 */
@Component
public class LobbyBoardsCache {

    /** Tablice w lobby, które unieważniamy niezależnie od siebie. */
    public enum Board {
        /** Feed dużych wygranych ({@code GET /api/feed/big-wins}). */
        BIG_WINS,
        /** Ranking „największa pojedyncza wygrana” ({@code GET /api/leaderboard?type=biggest-win}). */
        BIGGEST_WIN,
        /** Ranking „najwyższe saldo” ({@code GET /api/leaderboard?type=balance}). */
        BALANCE
    }

    private record Key(Board board, int limit) {
    }

    private record Entry(long generation, Instant storedAt, List<?> rows) {
    }

    private final Map<Board, AtomicLong> generations = new EnumMap<>(Board.class);
    private final ConcurrentMap<Key, Entry> entries = new ConcurrentHashMap<>();
    private final Duration ttl;
    private final Clock clock;

    public LobbyBoardsCache(CasinoProperties properties, Clock clock) {
        this.ttl = properties.lobby().cacheTtl();
        this.clock = clock;
        for (Board board : Board.values()) {
            generations.put(board, new AtomicLong());
        }
    }

    /**
     * Zwraca zapamiętane wiersze tablicy albo liczy je ({@code loader}) i zapamiętuje.
     *
     * @param board  która tablica
     * @param limit  ile wierszy (różne limity to różne wpisy)
     * @param loader zapytanie do bazy wykonywane przy braku aktualnego wpisu
     */
    @SuppressWarnings("unchecked")
    public <T> List<T> get(Board board, int limit, Supplier<List<T>> loader) {
        if (ttl.isZero() || ttl.isNegative()) {
            return loader.get();
        }
        AtomicLong generation = generations.get(board);
        Key key = new Key(board, limit);
        Instant now = clock.instant();
        Entry entry = entries.get(key);
        if (entry != null && entry.generation() == generation.get() && now.isBefore(entry.storedAt().plus(ttl))) {
            return (List<T>) entry.rows();
        }
        long before = generation.get();
        List<T> rows = List.copyOf(loader.get());
        if (generation.get() == before) {
            entries.put(key, new Entry(before, now, rows));
        }
        return rows;
    }

    /** Dane tablicy się zmieniły (wołane po zatwierdzeniu transakcji): kolejne odczyty pójdą do bazy. */
    public void invalidate(Board board) {
        generations.get(board).incrementAndGet();
    }

    /** Ile razy tablica była unieważniona od startu (do testów i diagnostyki). */
    public long generation(Board board) {
        return generations.get(board).get();
    }
}
