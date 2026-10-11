package pl.wsb.kasyno.report.application;

import org.springframework.stereotype.Service;
import pl.wsb.kasyno.report.application.LobbyBoardsCache.Board;
import pl.wsb.kasyno.shared.config.CasinoProperties;
import pl.wsb.kasyno.slots.api.BigWin;
import pl.wsb.kasyno.slots.api.SlotsFacade;
import pl.wsb.kasyno.wallet.api.WalletFacade;

import java.util.List;

/**
 * Ranking graczy i feed dużych wygranych do lobby.
 *
 * <p>Moduł {@code report} tylko czyta: nie ma własnych tabel, korzysta z fasad modułów {@code slots}
 * i {@code wallet} (nie z ich encji ani repozytoriów).
 *
 * <p>Wyniki przechodzą przez {@link LobbyBoardsCache}: lobby odpytuje feed i ranking co 45 sekund w każdej otwartej
 * karcie, a dane zmieniają się tylko po spinie. Cache unieważnia {@link LobbyBoardsListener} po zatwierdzeniu
 * transakcji spinu lub zmiany salda.
 *
 * <p>Brak {@code @Transactional} na tej klasie jest celowy: przy trafieniu w cache nie otwieramy transakcji ani nie
 * bierzemy połączenia z bazy. Przy braku wpisu zapytanie wykonuje fasada w swojej transakcji tylko do odczytu
 * ({@code SlotStatisticsService}, {@code WalletService} mają {@code @Transactional(readOnly = true)}), a encje są
 * zamieniane na rekordy jeszcze w niej.
 */
@Service
public class LeaderboardService {

    private final SlotsFacade slots;
    private final WalletFacade wallet;
    private final CasinoProperties properties;
    private final LobbyBoardsCache cache;

    public LeaderboardService(SlotsFacade slots, WalletFacade wallet, CasinoProperties properties,
                              LobbyBoardsCache cache) {
        this.slots = slots;
        this.wallet = wallet;
        this.properties = properties;
        this.cache = cache;
    }

    /** Ranking wybranego rodzaju, od pierwszego miejsca. */
    public List<LeaderboardRow> leaderboard(LeaderboardType type, int limit) {
        return switch (type) {
            case BIGGEST_WIN -> cache.get(Board.BIGGEST_WIN, limit, () -> slots.biggestWinLeaders(limit).stream()
                    .map(leader -> new LeaderboardRow(leader.nick(), leader.win(), leader.gameCode(), leader.at()))
                    .toList());
            case BALANCE -> cache.get(Board.BALANCE, limit, () -> wallet.topBalances(limit).stream()
                    .map(leader -> new LeaderboardRow(leader.nick(), leader.balance(), null, leader.updatedAt()))
                    .toList());
        };
    }

    /** Ostatnie wygrane ≥ {@code kasyno.big-win-multiplier} (15×) zakładu, od najnowszej. */
    public List<BigWin> recentBigWins(int limit) {
        return cache.get(Board.BIG_WINS, limit, () -> slots.recentBigWins(properties.bigWinMultiplier(), limit));
    }
}
