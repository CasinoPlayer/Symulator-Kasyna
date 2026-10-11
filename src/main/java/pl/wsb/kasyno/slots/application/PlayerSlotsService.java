package pl.wsb.kasyno.slots.application;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.wsb.kasyno.slots.domain.PlayerMachineStats;
import pl.wsb.kasyno.slots.domain.PlayerMachineStatsRepository;
import pl.wsb.kasyno.slots.domain.RoundSummary;
import pl.wsb.kasyno.slots.domain.SpinRoundRepository;

import java.util.List;

/**
 * Dane zalogowanego gracza z modułu automatów: historia rund i statystyki na automatach.
 *
 * <p>Historia to lekka projekcja {@link RoundSummary} (bez przebiegu rundy w JSON), a statystyki pobierają automat
 * w tym samym zapytaniu ({@code join fetch}), więc kontroler może bezpiecznie mapować wynik na DTO także po
 * zamknięciu transakcji ({@code open-in-view} jest wyłączone).
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

    /** Strona historii rund gracza, od najnowszej. */
    public Page<RoundSummary> history(Long playerId, int page, int size) {
        return rounds.findPlayerHistory(playerId, PageRequest.of(page, size));
    }

    /** Statystyki gracza na każdym automacie, na którym grał. */
    public List<PlayerMachineStats> stats(Long playerId) {
        return stats.findByPlayer(playerId);
    }
}
