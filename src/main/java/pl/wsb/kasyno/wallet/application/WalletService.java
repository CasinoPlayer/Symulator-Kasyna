package pl.wsb.kasyno.wallet.application;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import pl.wsb.kasyno.account.api.PlayerFunds;
import pl.wsb.kasyno.account.api.PlayerFundsProvider;
import pl.wsb.kasyno.account.api.PlayerRegistered;
import pl.wsb.kasyno.account.domain.UserAccountRepository;
import pl.wsb.kasyno.shared.config.CasinoProperties;
import pl.wsb.kasyno.shared.error.NotLoggedInException;
import pl.wsb.kasyno.wallet.api.BalanceChanged;
import pl.wsb.kasyno.wallet.api.BalanceLeader;
import pl.wsb.kasyno.wallet.api.MinimumBetProvider;
import pl.wsb.kasyno.wallet.api.WalletEconomy;
import pl.wsb.kasyno.wallet.api.WalletFacade;
import pl.wsb.kasyno.wallet.entity.TransactionType;
import pl.wsb.kasyno.wallet.entity.Wallet;
import pl.wsb.kasyno.wallet.entity.WalletRepository;
import pl.wsb.kasyno.wallet.entity.WalletTransaction;
import pl.wsb.kasyno.wallet.entity.WalletTransactionRepository;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Przypadki użycia portfela: założenie z bonusem powitalnym, zakład, wygrana, bonus ratunkowy, historia.
 *
 * <p>Zasady, których pilnuje ta klasa razem z encją {@link Wallet}:
 * <ul>
 *   <li>saldo nigdy nie jest ujemne (encja odrzuca zakład większy niż saldo);</li>
 *   <li>każda zmiana salda zapisuje {@link WalletTransaction} z saldem po operacji ({@code balanceAfter});</li>
 *   <li>każda zmiana salda pobiera portfel z blokadą pesymistyczną, więc równoległe żądania tego samego gracza
 *       nie nadpisują sobie salda;</li>
 *   <li>po każdej zmianie publikujemy zdarzenie {@link BalanceChanged}.</li>
 * </ul>
 *
 * <p>Klasa implementuje dwa kontrakty: {@link WalletFacade} (dla modułów {@code slots} i {@code report})
 * oraz port {@link PlayerFundsProvider} z modułu {@code account} (saldo do obiektu {@code player}).
 * {@code @Transactional} na klasie: każda publiczna metoda działa w transakcji (albo dołącza do już trwającej).
 */
@Service
@Transactional
public class WalletService implements WalletFacade, PlayerFundsProvider {

    private final WalletRepository wallets;
    private final WalletTransactionRepository transactions;
    private final UserAccountRepository accounts;
    private final MinimumBetProvider minimumBetProvider;
    private final CasinoProperties properties;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public WalletService(WalletRepository wallets, WalletTransactionRepository transactions,
                         UserAccountRepository accounts, MinimumBetProvider minimumBetProvider,
                         CasinoProperties properties, ApplicationEventPublisher events, Clock clock) {
        this.wallets = wallets;
        this.transactions = transactions;
        this.accounts = accounts;
        this.minimumBetProvider = minimumBetProvider;
        this.properties = properties;
        this.events = events;
        this.clock = clock;
    }

    /**
     * Nowy gracz w kasynie: zakładamy portfel i księgujemy bonus powitalny. Słuchacz synchroniczny
     * ({@code @EventListener}), więc działa w transakcji logowania: konto i portfel zapisują się razem.
     */
    @EventListener
    public void onPlayerRegistered(PlayerRegistered event) {
        openWallet(event.playerId(), event.welcomeBonus());
    }

    /**
     * Zakłada portfel z bonusem powitalnym. Gdy portfel już istnieje, nic nie robi: bonus powitalny
     * przysługuje tylko raz.
     */
    public BigDecimal openWallet(Long playerId, BigDecimal welcomeBonus) {
        return wallets.findByPlayerId(playerId)
                .map(Wallet::getBalance)
                .orElseGet(() -> {
                    Instant now = clock.instant();
                    Wallet wallet = wallets.save(new Wallet(accounts.getReferenceById(playerId), now));
                    return book(playerId, wallet.credit(TransactionType.WELCOME_BONUS, welcomeBonus, null, null, now));
                });
    }

    /**
     * {@code Propagation.MANDATORY}: blokada wiersza trwa do końca transakcji, więc wywołanie bez trwającej
     * transakcji (blokada zdjęta od razu po odczycie) to błąd w kodzie, a nie ciche „nic”.
     */
    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public BigDecimal lockWallet(Long playerId) {
        return lockedWallet(playerId).getBalance();
    }

    @Override
    public BigDecimal debit(Long playerId, BigDecimal amount, String gameCode, Long spinRoundId) {
        Wallet wallet = lockedWallet(playerId);
        return book(playerId, wallet.debitBet(amount, gameCode, spinRoundId, clock.instant()));
    }

    @Override
    public BigDecimal credit(Long playerId, BigDecimal amount, String gameCode, Long spinRoundId) {
        Wallet wallet = lockedWallet(playerId);
        return book(playerId, wallet.credit(TransactionType.WIN, amount, gameCode, spinRoundId, clock.instant()));
    }

    /**
     * Bonus ratunkowy: gdy saldo spadło poniżej najmniejszego zakładu i minęło 10 minut od poprzedniego.
     *
     * @return przyznana kwota
     * @throws pl.wsb.kasyno.wallet.entity.RescueNotAvailableException gdy bonus jest niedostępny
     */
    public BigDecimal rescue(Long playerId) {
        Wallet wallet = lockedWallet(playerId);
        WalletTransaction transaction = wallet.rescue(properties.rescueAmount(), minimumBetProvider.minimumBet(),
                properties.rescueCooldown(), clock.instant());
        book(playerId, transaction);
        return transaction.getAmount();
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal balance(Long playerId) {
        return wallet(playerId).getBalance();
    }

    /** Stan portfela do obiektu {@code player}: saldo, najmniejszy zakład i dostępność bonusu ratunkowego. */
    @Override
    @Transactional(readOnly = true)
    public PlayerFunds fundsOf(Long playerId) {
        Wallet wallet = wallet(playerId);
        BigDecimal minBet = minimumBetProvider.minimumBet();
        Duration cooldown = properties.rescueCooldown();
        Instant now = clock.instant();
        boolean bankrupt = wallet.isBankrupt(minBet);
        long secondsLeft = bankrupt ? Wallet.ceilSeconds(wallet.rescueCooldownLeft(cooldown, now)) : 0;
        return new PlayerFunds(wallet.getBalance(), minBet, wallet.canRescue(minBet, cooldown, now), secondsLeft);
    }

    /** Historia operacji gracza, od najnowszej. */
    @Transactional(readOnly = true)
    public Page<WalletTransaction> history(Long playerId, int page, int size) {
        return transactions.findPlayerHistory(playerId, PageRequest.of(page, size));
    }

    @Override
    @Transactional(readOnly = true)
    public List<BalanceLeader> topBalances(int limit) {
        return wallets.findTopBalances(PageRequest.of(0, limit));
    }

    @Override
    @Transactional(readOnly = true)
    public WalletEconomy economy(BigDecimal minBet) {
        return new WalletEconomy(
                wallets.count(),
                wallets.countByBalanceLessThan(minBet),
                wallets.sumBalances().orElse(BigDecimal.ZERO),
                transactions.sumAmountByType(TransactionType.WELCOME_BONUS).orElse(BigDecimal.ZERO),
                transactions.sumAmountByType(TransactionType.RESCUE_BONUS).orElse(BigDecimal.ZERO));
    }

    private Wallet wallet(Long playerId) {
        return wallets.findByPlayerId(playerId).orElseThrow(NotLoggedInException::new);
    }

    private Wallet lockedWallet(Long playerId) {
        return wallets.findByPlayerIdForUpdate(playerId).orElseThrow(NotLoggedInException::new);
    }

    /** Zapisuje wpis w historii, ogłasza zmianę salda i zwraca saldo po operacji. */
    private BigDecimal book(Long playerId, WalletTransaction transaction) {
        transactions.save(transaction);
        events.publishEvent(new BalanceChanged(playerId, transaction.getBalanceAfter(), transaction.getAmount(),
                transaction.getType().name(), transaction.getCreatedAt()));
        return transaction.getBalanceAfter();
    }
}
