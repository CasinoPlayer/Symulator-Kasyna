package pl.wsb.kasyno.wallet.domain;

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
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Jeden wpis w historii portfela (tabela {@code wallet_transaction}): bonus, zakład albo wygrana.
 *
 * <p>Wpisów nigdy nie zmieniamy ani nie usuwamy (to „księga”, jak wyciąg z konta), dlatego klasa nie ma setterów.
 * {@code balanceAfter} zapisuje saldo po operacji, więc historię można sprawdzić krok po kroku.
 *
 * <p>Powiązanie z rundą gry to zwykła liczba {@code spinRoundId}, a nie relacja {@code @ManyToOne SpinRound}:
 * moduł portfela nie zna modułu automatów ({@code slots} zależy od {@code wallet}, a nie odwrotnie), więc
 * nie ma cyklu zależności. {@code gameCode} zapisujemy z tego samego powodu jako tekst.
 */
@Entity
@Table(name = "wallet_transaction",
        indexes = @Index(name = "ix_wallet_transaction_wallet_created", columnList = "wallet_id, created_at"))
public class WalletTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "wallet_id", nullable = false)
    private Wallet wallet;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private TransactionType type;

    /** Kwota ze znakiem: dodatnia dla bonusów i wygranych, ujemna dla zakładu. */
    @Column(name = "amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    @Column(name = "balance_after", nullable = false, precision = 19, scale = 2)
    private BigDecimal balanceAfter;

    /** Kod gry, np. {@code cebulowy-777}; {@code null} dla bonusów. */
    @Column(name = "game_code", length = 40)
    private String gameCode;

    /** Identyfikator rundy ({@code spin_round.id}); {@code null} dla bonusów. */
    @Column(name = "spin_round_id")
    private Long spinRoundId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected WalletTransaction() {
    }

    /** Tworzy go wyłącznie {@link Wallet} (konstruktor pakietowy), więc nie powstanie wpis niezgodny z saldem. */
    WalletTransaction(Wallet wallet, TransactionType type, BigDecimal amount, BigDecimal balanceAfter,
                      String gameCode, Long spinRoundId, Instant createdAt) {
        this.wallet = wallet;
        this.type = type;
        this.amount = amount;
        this.balanceAfter = balanceAfter;
        this.gameCode = gameCode;
        this.spinRoundId = spinRoundId;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public Wallet getWallet() {
        return wallet;
    }

    public TransactionType getType() {
        return type;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public BigDecimal getBalanceAfter() {
        return balanceAfter;
    }

    public String getGameCode() {
        return gameCode;
    }

    public Long getSpinRoundId() {
        return spinRoundId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
