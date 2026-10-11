package pl.wsb.kasyno.slots.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import pl.wsb.kasyno.account.domain.UserAccount;
import pl.wsb.kasyno.shared.domain.Money;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;

/**
 * Jedna runda gry = jeden zakład (tabela {@code spin_round}). Obiekt ze statusem i cyklem życia
 * ({@link SpinStatus}: {@code STARTED → RESOLVED → SETTLED}, albo {@code FAILED}).
 *
 * <p>Status zmienia się wyłącznie przez metody {@link #resolve}, {@link #settle} i {@link #fail}, które sprawdzają,
 * czy przejście jest dozwolone. Nie ma {@code setStatus()}, więc nie da się np. rozliczyć rundy dwa razy
 * (dwukrotna wypłata wygranej) ani rozliczyć rundy bez wyniku.
 *
 * <ul>
 *   <li>{@code seed}: ziarno generatora losowego; z nim silnik gry odtworzy dokładnie ten sam wynik
 *       (audyt, testy, nagrywanie filmików do lobby);</li>
 *   <li>{@code resultJson}: pełny wynik z silnika (kroki animacji: obrót, kaskady, darmowe spiny), zapisany jako
 *       {@code CLOB}; ten sam JSON dostaje przeglądarka, także przy powtórzeniu żądania z tym samym kluczem;</li>
 *   <li>{@code idempotencyKey}: klucz z nagłówka {@code Idempotency-Key}; para (gracz, klucz) jest unikalna, więc
 *       podwójne kliknięcie „SPIN” nie pobierze zakładu dwa razy.</li>
 * </ul>
 */
@Entity
@Table(name = "spin_round",
        uniqueConstraints = @UniqueConstraint(name = "uk_spin_round_player_idempotency",
                columnNames = {"user_id", "idempotency_key"}),
        indexes = {
                @Index(name = "ix_spin_round_player_created", columnList = "user_id, created_at"),
                @Index(name = "ix_spin_round_created", columnList = "created_at")
        })
public class SpinRound {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount player;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "slot_machine_id", nullable = false)
    private SlotMachine slotMachine;

    @Column(name = "bet", nullable = false, precision = 19, scale = 2)
    private BigDecimal bet;

    @Column(name = "total_win", nullable = false, precision = 19, scale = 2)
    private BigDecimal totalWin;

    /** Wygrana jako wielokrotność zakładu ({@code totalWin / bet}), np. {@code 2.50}. */
    @Column(name = "multiplier", nullable = false, precision = 19, scale = 2)
    private BigDecimal multiplier;

    @Enumerated(EnumType.STRING)
    @Column(name = "tier", nullable = false, length = 10)
    private WinTier tier;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private SpinStatus status;

    @Column(name = "seed", nullable = false)
    private long seed;

    @Lob
    @Column(name = "result_json")
    private String resultJson;

    @Column(name = "idempotency_key", length = 64)
    private String idempotencyKey;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /** Kiedy runda się zakończyła (SETTLED albo FAILED). */
    @Column(name = "settled_at")
    private Instant settledAt;

    protected SpinRound() {
    }

    /** Nowa runda w statusie {@link SpinStatus#STARTED}: zakład przyjęty, wynik jeszcze nieznany. */
    public SpinRound(UserAccount player, SlotMachine slotMachine, BigDecimal bet, long seed, String idempotencyKey,
                     Instant createdAt) {
        if (!Money.isPositive(bet)) {
            throw new IllegalArgumentException("Zakład musi być dodatni");
        }
        this.player = player;
        this.slotMachine = slotMachine;
        this.bet = Money.normalize(bet);
        this.totalWin = Money.normalize(BigDecimal.ZERO);
        this.multiplier = Money.normalize(BigDecimal.ZERO);
        this.tier = WinTier.NONE;
        this.status = SpinStatus.STARTED;
        this.seed = seed;
        this.idempotencyKey = idempotencyKey;
        this.createdAt = createdAt;
    }

    /**
     * {@code STARTED → RESOLVED}: silnik gry wylosował wynik. Liczymy tu mnożnik i poziom wygranej,
     * żeby były spójne z kwotą (nikt nie poda ich osobno, „z ręki”).
     */
    public void resolve(BigDecimal win, String resultJson) {
        if (win == null || win.signum() < 0) {
            throw new IllegalArgumentException("Wygrana nie może być ujemna");
        }
        if (resultJson == null || resultJson.isBlank()) {
            throw new IllegalArgumentException("Wynik rundy (JSON) jest wymagany");
        }
        moveTo(SpinStatus.RESOLVED);
        this.totalWin = Money.normalize(win);
        this.multiplier = totalWin.divide(bet, Money.SCALE, RoundingMode.HALF_UP);
        this.tier = WinTier.of(totalWin, bet);
        this.resultJson = resultJson;
    }

    /** {@code RESOLVED → SETTLED}: wygrana zaksięgowana w portfelu. */
    public void settle(Instant at) {
        moveTo(SpinStatus.SETTLED);
        this.settledAt = at;
    }

    /** {@code STARTED/RESOLVED → FAILED}: runda przerwana. */
    public void fail(Instant at) {
        moveTo(SpinStatus.FAILED);
        this.settledAt = at;
    }

    /** Czy powtórzone żądanie (ten sam klucz idempotencji) dotyczy tej samej gry i tego samego zakładu. */
    public boolean matchesRequest(String gameCode, BigDecimal requestedBet) {
        return slotMachine.getCode().equals(gameCode) && requestedBet != null && bet.compareTo(requestedBet) == 0;
    }

    public boolean hasWin() {
        return totalWin.signum() > 0;
    }

    private void moveTo(SpinStatus target) {
        if (!status.canTransitionTo(target)) {
            throw new InvalidSpinTransitionException(id, status, target);
        }
        this.status = target;
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

    public BigDecimal getBet() {
        return bet;
    }

    public BigDecimal getTotalWin() {
        return totalWin;
    }

    public BigDecimal getMultiplier() {
        return multiplier;
    }

    public WinTier getTier() {
        return tier;
    }

    public SpinStatus getStatus() {
        return status;
    }

    public long getSeed() {
        return seed;
    }

    public String getResultJson() {
        return resultJson;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getSettledAt() {
        return settledAt;
    }
}
