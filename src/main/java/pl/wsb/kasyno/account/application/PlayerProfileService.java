package pl.wsb.kasyno.account.application;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.wsb.kasyno.account.api.PlayerAvatar;
import pl.wsb.kasyno.account.api.PlayerFunds;
import pl.wsb.kasyno.account.api.PlayerFundsProvider;
import pl.wsb.kasyno.account.api.PlayerProfiles;
import pl.wsb.kasyno.account.api.PlayerView;
import pl.wsb.kasyno.account.domain.UserAccount;
import pl.wsb.kasyno.account.domain.UserAccountRepository;
import pl.wsb.kasyno.shared.error.NotLoggedInException;

import java.time.ZoneId;

/**
 * Składa obiekt {@code player} z danych konta i stanu portfela (port {@link PlayerFundsProvider}).
 *
 * <p>{@code readOnly = true}: transakcja tylko do odczytu; Hibernate nie sprawdza wtedy zmian w encjach
 * przy zamknięciu transakcji, więc jest szybciej.
 */
@Service
public class PlayerProfileService implements PlayerProfiles {

    private final UserAccountRepository accounts;
    private final PlayerFundsProvider funds;

    public PlayerProfileService(UserAccountRepository accounts, PlayerFundsProvider funds) {
        this.accounts = accounts;
        this.funds = funds;
    }

    @Override
    @Transactional(readOnly = true)
    public PlayerView view(Long playerId) {
        UserAccount account = accounts.findById(playerId).orElseThrow(NotLoggedInException::new);
        PlayerFunds money = funds.fundsOf(playerId);
        return new PlayerView(
                account.getId(),
                account.getDisplayName(),
                PlayerAvatar.indexFor(account.getDisplayName()),
                money.balance(),
                money.minBet(),
                money.canRescue(),
                money.rescueAvailableInSeconds(),
                // UserAccount (z szablonu) zapisuje czas lokalny serwera, a API podaje daty w UTC
                account.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant());
    }
}
