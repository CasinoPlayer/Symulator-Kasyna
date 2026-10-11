package pl.wsb.kasyno.slots.application;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.wsb.kasyno.slots.domain.PlayerMachineStats;
import pl.wsb.kasyno.slots.domain.PlayerMachineStatsRepository;
import pl.wsb.kasyno.slots.domain.SpinRound;
import pl.wsb.kasyno.slots.domain.SpinRoundRepository;

import java.util.List;

/**
 * Dane zalogowanego gracza z modułu automatów: historia rund i statystyki na automatach.
 * Zapytania pobierają od razu automat ({@code join fetch}), więc kontroler może bezpiecznie mapować wynik na DTO
 * także po zamknięciu transakcji.
 */
@Service
@Transactional(readOnly = true)
public class PlayerSlotsService {

    private final SpinRoundRepository rounds;
    private final PlayerMachineStatsRepository stats;

    public PlayerSlotsService(SpinRoundRepository rounds, PlayerMachineStatsRepository stats) {
        this.rounds = rounds;
        this.stats = stats;
    }

    public Page<SpinRound> history(Long playerId, int page, int size) {
        return rounds.findPlayerHistory(playerId, PageRequest.of(page, size));
    }

    public List<PlayerMachineStats> stats(Long playerId) {
        return stats.findByPlayer(playerId);
    }
}
