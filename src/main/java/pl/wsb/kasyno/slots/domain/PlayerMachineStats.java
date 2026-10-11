package pl.wsb.kasyno.slots.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import pl.wsb.kasyno.account.domain.UserAccount;
import pl.wsb.kasyno.shared.domain.Money;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Statystyki gracza na danym automacie (tabela {@code player_machine_stats}).
 *
 * <p>To relacja wiele-do-wielu z własnymi atrybutami (wymaganie koncepcji projektu): gracz gra na wielu
 * automatach, na automacie gra wielu graczy, a para (gracz, automat) ma swoje liczby: spiny, obrót, wygrane,
 * rekord. Zamiast {@code @ManyToMany} (które umie tylko „samą parę”) mamy encję łączącą z dwiema relacjami
 * {@code @ManyToOne} i unikalną parą {@code (user_id, slot_machine_id)}.
 *
 * <p>Tabela jest „podsumowaniem” rund: aktualizuje ją {@code StatsUpdater} po każdym spinie, w tej samej
 * transakcji. Dzięki temu ranking i ekran statystyk nie muszą sumować tysięcy rund przy każdym wyświetleniu.
 */
@Entity
@Table(name = "player_machine_stats",
        uniqueConstraints = @UniqueConstraint(name = "uk_player_machine_stats_player_machine",
                columnNames = {"user_id", "slot_machine_id"}))
public class PlayerMachineStats {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount player;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "slot_machine_id", nullable = false)
    private SlotMachine slotMachine;

    @Column(name = "spins", nullable = false)
    private long spins;

    @Column(name = "total_wagered", nullable = false, precision = 19, scale = 2)
    private BigDecimal totalWagered;

    @Column(name = "total_won", nullable = false, precision = 19, scale = 2)
    private BigDecimal totalWon;

    /** Największa pojedyncza wygrana gracza na tym automacie (do rankingu). */
    @Column(name = "biggest_win", nullable = false, precision = 19, scale = 2)
    private BigDecimal biggestWin;

    /** Kiedy padła największa wygrana (ranking pokazuje datę rekordu). */
    @Column(name = "biggest_win_at")
    private Instant biggestWinAt;

    @Column(name = "last_played_at")
    private Instant lastPlayedAt;

    protected PlayerMachineStats() {
    }

    public PlayerMachineStats(UserAccount player, SlotMachine slotMachine) {
        this.player = player;
        this.slotMachine = slotMachine;
        this.spins = 0;
        this.totalWagered = Money.normalize(BigDecimal.ZERO);
        this.totalWon = Money.normalize(BigDecimal.ZERO);
        this.biggestWin = Money.normalize(BigDecimal.ZERO);
    }

    /** Dolicza jedną rozegraną rundę: spin, obrót, wygraną, ewentualny nowy rekord i czas ostatniej gry. */
    public void record(BigDecimal bet, BigDecimal win, Instant at) {
        spins++;
        totalWagered = Money.normalize(totalWagered.add(bet));
        totalWon = Money.normalize(totalWon.add(win));
        if (win.compareTo(biggestWin) > 0) {
            biggestWin = Money.normalize(win);
            biggestWinAt = at;
        }
        lastPlayedAt = at;
    }

    /** Bilans gracza na automacie: wygrane minus postawione (ujemny, gdy gracz jest „na minusie”). */
    public BigDecimal netResult() {
        return totalWon.subtract(totalWagered);
    }

    public Long getId() {
        return id;
    }

    public UserAccount getPlayer() {
        return player;
    }

    public SlotMachine getSlotMachine() {
        return slotMachine;
    }

    public long getSpins() {
        return spins;
    }

    public BigDecimal getTotalWagered() {
        return totalWagered;
    }

    public BigDecimal getTotalWon() {
        return totalWon;
    }

    public BigDecimal getBiggestWin() {
        return biggestWin;
    }

    public Instant getBiggestWinAt() {
        return biggestWinAt;
    }

    public Instant getLastPlayedAt() {
        return lastPlayedAt;
    }
}
