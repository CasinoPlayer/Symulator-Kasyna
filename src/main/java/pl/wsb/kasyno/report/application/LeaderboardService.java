package pl.wsb.kasyno.report.application;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.wsb.kasyno.shared.config.CasinoProperties;
import pl.wsb.kasyno.slots.api.BigWin;
import pl.wsb.kasyno.slots.api.SlotsFacade;
import pl.wsb.kasyno.wallet.api.WalletFacade;

import java.util.List;

/**
 * Ranking graczy i feed dużych wygranych do lobby.
 *
 * <p>Moduł {@code report} tylko czyta: nie ma własnych tabel, korzysta z fasad modułów {@code slots}
 * i {@code wallet} (nie z ich encji ani repozytoriów). Dlatego transakcja jest tylko do odczytu.
 */
@Service
@Transactional(readOnly = true)
public class LeaderboardService {

    private final SlotsFacade slots;
    private final WalletFacade wallet;
    private final CasinoProperties properties;

    public LeaderboardService(SlotsFacade slots, WalletFacade wallet, CasinoProperties properties) {
        this.slots = slots;
        this.wallet = wallet;
        this.properties = properties;
    }

    /** Ranking wybranego rodzaju, od pierwszego miejsca. */
    public List<LeaderboardRow> leaderboard(LeaderboardType type, int limit) {
        return switch (type) {
            case BIGGEST_WIN -> slots.biggestWinLeaders(limit).stream()
                    .map(leader -> new LeaderboardRow(leader.nick(), leader.win(), leader.gameCode(), leader.at()))
                    .toList();
            case BALANCE -> wallet.topBalances(limit).stream()
                    .map(leader -> new LeaderboardRow(leader.nick(), leader.balance(), null, leader.updatedAt()))
                    .toList();
        };
    }

    /** Ostatnie wygrane ≥ {@code kasyno.big-win-multiplier} (15×) zakładu, od najnowszej. */
    public List<BigWin> recentBigWins(int limit) {
        return slots.recentBigWins(properties.bigWinMultiplier(), limit);
    }
}
