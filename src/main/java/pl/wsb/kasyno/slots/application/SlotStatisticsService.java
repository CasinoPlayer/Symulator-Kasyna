package pl.wsb.kasyno.slots.application;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.wsb.kasyno.slots.api.BigWin;
import pl.wsb.kasyno.slots.api.BiggestWinLeader;
import pl.wsb.kasyno.slots.api.GamePopularity;
import pl.wsb.kasyno.slots.api.GameRtp;
import pl.wsb.kasyno.slots.api.HourlyActivity;
import pl.wsb.kasyno.slots.api.PlayerResult;
import pl.wsb.kasyno.slots.api.SlotsFacade;
import pl.wsb.kasyno.slots.domain.PlayerMachineStats;
import pl.wsb.kasyno.slots.domain.PlayerMachineStatsRepository;
import pl.wsb.kasyno.slots.domain.SpinRound;
import pl.wsb.kasyno.slots.domain.SpinRoundRepository;
import pl.wsb.kasyno.slots.domain.SpinStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Implementacja fasady {@link SlotsFacade}: statystyki i rankingi liczone z rund i statystyk graczy.
 * Wszystko tylko do odczytu; encje zamieniamy na rekordy z pakietu {@code api} jeszcze w transakcji.
 */
@Service
@Transactional(readOnly = true)
public class SlotStatisticsService implements SlotsFacade {

    private final SpinRoundRepository rounds;
    private final PlayerMachineStatsRepository stats;
    private final SlotCatalogService catalog;

    public SlotStatisticsService(SpinRoundRepository rounds, PlayerMachineStatsRepository stats,
                                 SlotCatalogService catalog) {
        this.rounds = rounds;
        this.stats = stats;
        this.catalog = catalog;
    }

    @Override
    public BigDecimal minimumBet() {
        return catalog.minimumBet();
    }

    @Override
    public List<GamePopularity> popularGames(Instant since) {
        return rounds.findPopularity(since, SpinStatus.SETTLED);
    }

    @Override
    public List<GameRtp> rtpByGame() {
        return rounds.findRtp(SpinStatus.SETTLED);
    }

    @Override
    public List<PlayerResult> topPlayersByNetResult(int limit) {
        return stats.findTopByNetResult(PageRequest.of(0, limit));
    }

    @Override
    public List<PlayerResult> topPlayersByBiggestWin(int limit) {
        return stats.findTopByBiggestWin(PageRequest.of(0, limit));
    }

    @Override
    public List<HourlyActivity> peakHours() {
        return rounds.findHourlyActivity(SpinStatus.SETTLED);
    }

    @Override
    public List<BigWin> recentBigWins(BigDecimal minMultiplier, int limit) {
        return rounds.findBigWins(SpinStatus.SETTLED, minMultiplier, PageRequest.of(0, limit)).stream()
                .map(SlotStatisticsService::toBigWin)
                .toList();
    }

    @Override
    public List<BiggestWinLeader> biggestWinLeaders(int limit) {
        // pobieramy z zapasem, bo gracz z równym rekordem na dwóch automatach daje dwa wiersze
        List<PlayerMachineStats> holders = stats.findRecordHolders(PageRequest.of(0, limit * 2));
        Set<Long> seenPlayers = new HashSet<>();
        return holders.stream()
                .filter(row -> seenPlayers.add(row.getPlayer().getId()))
                .limit(limit)
                .map(row -> new BiggestWinLeader(row.getPlayer().getId(), row.getPlayer().getDisplayName(),
                        row.getBiggestWin(), row.getSlotMachine().getCode(), row.getBiggestWinAt()))
                .toList();
    }

    private static BigWin toBigWin(SpinRound round) {
        return new BigWin(
                round.getPlayer().getDisplayName(),
                round.getSlotMachine().getCode(),
                round.getSlotMachine().getName(),
                round.getTotalWin(),
                round.getMultiplier(),
                round.getTier().code(),
                round.getSettledAt() != null ? round.getSettledAt() : round.getCreatedAt());
    }
}
