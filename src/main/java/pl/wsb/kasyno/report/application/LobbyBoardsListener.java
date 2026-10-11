package pl.wsb.kasyno.report.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import pl.wsb.kasyno.report.application.LobbyBoardsCache.Board;
import pl.wsb.kasyno.shared.config.CasinoProperties;
import pl.wsb.kasyno.slots.api.SpinCompleted;
import pl.wsb.kasyno.wallet.api.BalanceChanged;

/**
 * Reaguje na zdarzenia z innych modułów <b>po zatwierdzeniu transakcji</b> (LAB 06): odświeża feed dużych wygranych
 * i rankingi w lobby oraz zapisuje duże wygrane w logu.
 *
 * <p>Dwa rodzaje słuchaczy w aplikacji, celowo różne:
 * <ul>
 *   <li>{@code StatsUpdater} ({@code @EventListener}, synchronicznie, <i>w</i> transakcji spinu): statystyki gracza
 *       muszą zapisać się razem z rundą albo wcale, więc ich błąd wycofuje cały spin;</li>
 *   <li>ta klasa ({@code @TransactionalEventListener(phase = AFTER_COMMIT)}): feed i ranking to tylko widok danych.
 *       Reagujemy dopiero, gdy runda i saldo są już trwale w bazie i widoczne dla innych transakcji.</li>
 * </ul>
 *
 * <p>Dlaczego {@code AFTER_COMMIT}, a nie zwykły {@code @EventListener}:
 * <ol>
 *   <li>spin, który się wycofa (np. błąd po pobraniu zakładu), nie może pojawić się w feedzie ani w logu „duża
 *       wygrana”: przy wycofaniu ta metoda w ogóle się nie wykona;</li>
 *   <li>unieważnienie pamięci podręcznej przed commitem byłoby za wcześnie: równoległe żądanie lobby mogłoby
 *       jeszcze odczytać stary stan bazy i zapamiętać go jako aktualny (szczegóły w {@link LobbyBoardsCache});</li>
 *   <li>błąd w tym słuchaczu nie psuje spinu: transakcja jest już zatwierdzona, a Spring tylko zapisze błąd w logu.</li>
 * </ol>
 *
 * <p>Słuchacz nie dotyka bazy (tylko pamięć i log). Gdyby kiedyś miał coś zapisać, potrzebowałby nowej transakcji
 * ({@code @Transactional(propagation = REQUIRES_NEW)}), bo po commicie poprzednia jest już zamknięta.
 *
 * <p>Zdarzenie opublikowane poza transakcją jest przez {@code @TransactionalEventListener} pomijane; u nas oba
 * zdarzenia publikują serwisy z {@code @Transactional} ({@code SpinService}, {@code WalletService}).
 */
@Component
public class LobbyBoardsListener {

    private static final Logger log = LoggerFactory.getLogger(LobbyBoardsListener.class);

    private final LobbyBoardsCache cache;
    private final CasinoProperties properties;

    public LobbyBoardsListener(LobbyBoardsCache cache, CasinoProperties properties) {
        this.cache = cache;
        this.properties = properties;
    }

    /**
     * Rozliczony spin: każda wygrana może być nowym rekordem gracza (ranking „największa wygrana”), a wygrana
     * ≥ {@code kasyno.big-win-multiplier} × zakład (15×) trafia do feedu i do logu.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onSpinCompleted(SpinCompleted event) {
        if (event.win().signum() <= 0) {
            return;
        }
        cache.invalidate(Board.BIGGEST_WIN);
        if (event.win().compareTo(event.bet().multiply(properties.bigWinMultiplier())) >= 0) {
            cache.invalidate(Board.BIG_WINS);
            // log w formacie klucz=wartość: czytelny dla człowieka i łatwy do przefiltrowania (grep big_win)
            log.info("big_win round={} player={} game={} bet={} win={} multiplier={} tier={} at={}",
                    event.roundId(), event.playerId(), event.gameCode(), event.bet().toPlainString(),
                    event.win().toPlainString(), event.multiplier().toPlainString(), event.tier(), event.at());
        }
    }

    /** Zmiana salda (zakład, wygrana, bonus): ranking najwyższych sald jest nieaktualny. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onBalanceChanged(BalanceChanged event) {
        cache.invalidate(Board.BALANCE);
    }
}
