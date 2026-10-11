package pl.wsb.kasyno.slots.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Publiczny kontrakt modułu automatów dla innych modułów (głównie raportów). Zwraca tylko rekordy z pakietu
 * {@code api}, nigdy encji: inne moduły nie zależą od tego, jak {@code slots} przechowuje dane.
 */
public interface SlotsFacade {

    /** Najmniejszy zakład spośród aktywnych gier. */
    BigDecimal minimumBet();

    /** Pytanie inwestora 1: liczba rund na automat od chwili {@code since}, od najpopularniejszego. */
    List<GamePopularity> popularGames(Instant since);

    /** Pytanie inwestora 2: rzeczywisty i docelowy RTP każdego automatu. */
    List<GameRtp> rtpByGame();

    /** Pytanie inwestora 3a: gracze z najlepszym bilansem (wygrane − zakłady). */
    List<PlayerResult> topPlayersByNetResult(int limit);

    /** Pytanie inwestora 3b: gracze z największą pojedynczą wygraną. */
    List<PlayerResult> topPlayersByBiggestWin(int limit);

    /** Pytanie inwestora 5: liczba rund i średni zakład w każdej godzinie doby. */
    List<HourlyActivity> peakHours();

    /** Ostatnie wygrane wynoszące co najmniej {@code minMultiplier} × zakład, od najnowszej. */
    List<BigWin> recentBigWins(BigDecimal minMultiplier, int limit);

    /** Ranking: rekord (największa wygrana) każdego gracza, od największego. */
    List<BiggestWinLeader> biggestWinLeaders(int limit);
}
