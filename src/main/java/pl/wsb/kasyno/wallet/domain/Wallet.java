package pl.wsb.kasyno.wallet.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import pl.wsb.kasyno.account.domain.UserAccount;
import pl.wsb.kasyno.shared.domain.Money;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;

/**
 * Portfel gracza: saldo w cebulionach (tabela {@code wallet}, relacja 1:1 z kontem {@code user_account}).
 *
 * <p>To „bogata” encja: sama pilnuje swoich reguł, zamiast pozwalać serwisom na dowolne {@code setBalance()}.
 * Saldo zmienia się tylko przez {@link #credit}, {@link #debitBet} i {@link #rescue}, a każda z tych metod
 * zwraca wpis {@link WalletTransaction} z saldem po operacji. Dzięki temu:
 * <ul>
 *   <li>saldo nigdy nie jest ujemne ({@link InsufficientFundsException} leci przed zmianą),</li>
 *   <li>każda zmiana salda ma swój wpis w historii (audyt: suma kwot transakcji = saldo),</li>
 *   <li>reguły da się przetestować zwykłym testem jednostkowym, bez bazy i bez Springa.</li>
 * </ul>
 *
 * <p>Współbieżność: serwis pobiera portfel z blokadą pesymistyczną ({@code SELECT ... FOR UPDATE}), więc dwa
 * równoległe spiny tego samego gracza wykonują się po kolei. {@code @Version} (blokada optymistyczna) to drugi
 * bezpiecznik: gdyby ktoś zmienił portfel bez blokady, zapis starszej wersji się nie uda.
 */
@Entity
@Table(name = "wallet")
public class Wallet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Właściciel portfela. LAZY: konto ładujemy z bazy dopiero, gdy jest naprawdę potrzebne. */
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private UserAccount player;

    @Column(name = "balance", nullable = false, precision = 19, scale = 2)
    private BigDecimal balance;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /** Kiedy gracz ostatnio dostał bonus ratunkowy ({@code null}: jeszcze nigdy). */
    @Column(name = "last_rescue_at")
    private Instant lastRescueAt;

    /** Konstruktor dla JPA (Hibernate tworzy obiekt, a potem wypełnia pola z bazy). */
    protected Wallet() {
    }

    /** Nowy, pusty portfel. Bonus powitalny księguje się osobno ({@link #credit}), żeby miał swój wpis w historii. */
    public Wallet(UserAccount player, Instant now) {
        this.player = player;
        this.balance = Money.normalize(BigDecimal.ZERO);
        this.updatedAt = now;
    }

    /**
     * Dopisuje środki: wygraną ({@link TransactionType#WIN}) albo bonus powitalny
     * ({@link TransactionType#WELCOME_BONUS}). Bonus ratunkowy ma własne reguły: {@link #rescue}.
     */
    public WalletTransaction credit(TransactionType type, BigDecimal amount, String gameCode, Long spinRoundId,
                                    Instant now) {
        if (type != TransactionType.WIN && type != TransactionType.WELCOME_BONUS) {
            throw new IllegalArgumentException("Metoda credit obsługuje tylko WIN i WELCOME_BONUS, a nie " + type);
        }
        return addFunds(type, amount, gameCode, spinRoundId, now);
    }

    /**
     * Pobiera zakład ({@link TransactionType#BET}). Najpierw sprawdza saldo, dopiero potem je zmienia.
     *
     * @throws InsufficientFundsException gdy saldo jest mniejsze niż zakład
     */
    public WalletTransaction debitBet(BigDecimal amount, String gameCode, Long spinRoundId, Instant now) {
        requirePositive(amount);
        if (balance.compareTo(amount) < 0) {
            throw new InsufficientFundsException(balance, amount);
        }
        balance = Money.normalize(balance.subtract(amount));
        updatedAt = now;
        // kwota zakładu w historii jest ujemna: suma wszystkich kwot transakcji zawsze równa się saldu
        return new WalletTransaction(this, TransactionType.BET, Money.normalize(amount).negate(), balance,
                gameCode, spinRoundId, now);
    }

    /** „Bankrut”: saldo nie wystarcza nawet na najmniejszy zakład w kasynie. */
    public boolean isBankrupt(BigDecimal minBet) {
        return balance.compareTo(minBet) < 0;
    }

    /** Ile jeszcze trwa odliczanie do kolejnego bonusu ratunkowego (zero, gdy już można). */
    public Duration rescueCooldownLeft(Duration cooldown, Instant now) {
        if (lastRescueAt == null) {
            return Duration.ZERO;
        }
        Duration left = Duration.between(now, lastRescueAt.plus(cooldown));
        return left.isNegative() ? Duration.ZERO : left;
    }

    /** Czy bonus ratunkowy można odebrać teraz: saldo poniżej najmniejszego zakładu i minęło odliczanie. */
    public boolean canRescue(BigDecimal minBet, Duration cooldown, Instant now) {
        return isBankrupt(minBet) && rescueCooldownLeft(cooldown, now).isZero();
    }

    /**
     * Bonus ratunkowy ({@link TransactionType#RESCUE_BONUS}).
     *
     * @throws RescueNotAvailableException gdy saldo wystarcza na zakład albo nie minęło odliczanie
     */
    public WalletTransaction rescue(BigDecimal amount, BigDecimal minBet, Duration cooldown, Instant now) {
        if (!isBankrupt(minBet)) {
            throw RescueNotAvailableException.balanceTooHigh();
        }
        Duration left = rescueCooldownLeft(cooldown, now);
        if (!left.isZero()) {
            throw RescueNotAvailableException.coolingDown(ceilSeconds(left));
        }
        lastRescueAt = now;
        return addFunds(TransactionType.RESCUE_BONUS, amount, null, null, now);
    }

    /** Zaokrąglenie czasu w górę do pełnych sekund (lepiej pokazać „1 s” niż „0 s”, gdy zostało 300 ms). */
    public static long ceilSeconds(Duration duration) {
        long millis = Math.max(0, duration.toMillis());
        return (millis + 999) / 1000;
    }

    private WalletTransaction addFunds(TransactionType type, BigDecimal amount, String gameCode, Long spinRoundId,
                                       Instant now) {
        requirePositive(amount);
        balance = Money.normalize(balance.add(amount));
        updatedAt = now;
        return new WalletTransaction(this, type, Money.normalize(amount), balance, gameCode, spinRoundId, now);
    }

    private static void requirePositive(BigDecimal amount) {
        if (!Money.isPositive(amount)) {
            throw new IllegalArgumentException("Kwota operacji musi być dodatnia, a jest: " + amount);
        }
    }

    public Long getId() {
        return id;
    }

    public UserAccount getPlayer() {
        return player;
    }

    public BigDecimal getBalance() {
        return balance;
    }

    public long getVersion() {
        return version;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getLastRescueAt() {
        return lastRescueAt;
    }
}
