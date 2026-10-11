package pl.wsb.kasyno.account.application;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.wsb.kasyno.account.api.PlayerRegistered;
import pl.wsb.kasyno.account.domain.AccountRole;
import pl.wsb.kasyno.account.domain.UserAccount;
import pl.wsb.kasyno.account.domain.UserAccountRepository;
import pl.wsb.kasyno.shared.config.CasinoProperties;

import java.math.BigDecimal;
import java.util.Locale;

/**
 * Przypadek użycia „wejdź do kasyna, wpisując nazwę gracza”.
 *
 * <p>Przebieg:
 * <ol>
 *   <li>{@link NickPolicy} sprawdza nazwę (długość, znaki, zakazane słowa);</li>
 *   <li>szukamy konta po technicznym e-mailu {@code <nazwa-małymi-literami>@kasyno.local}, więc wielkość liter
 *       nie ma znaczenia („Kamil” = „kamil”);</li>
 *   <li>powracający gracz: zwracamy jego konto, bez bonusu;</li>
 *   <li>nowy gracz: zapisujemy {@code UserAccount} (rola {@code USER}) i publikujemy {@link PlayerRegistered}.
 *       Moduł portfela słucha tego zdarzenia i w tej samej transakcji zakłada portfel z bonusem powitalnym
 *       (transakcja {@code WELCOME_BONUS}). Bonus jest więc przyznawany dokładnie raz: przy utworzeniu konta.</li>
 * </ol>
 *
 * <p>Logowanie bez hasła to świadome uproszczenie z wymagań projektu (plan, § 5.8): waluta nie ma wartości,
 * a ograniczenie opisujemy w dokumentacji razem z propozycją poprawy (PIN, OAuth).
 */
@Service
public class LoginService {

    /** Domena technicznych adresów e-mail graczy (kolumna {@code email} w {@code user_account} jest obowiązkowa). */
    static final String TECHNICAL_EMAIL_DOMAIN = "@kasyno.local";

    private final UserAccountRepository accounts;
    private final NickPolicy nickPolicy;
    private final ApplicationEventPublisher events;
    private final CasinoProperties properties;

    public LoginService(UserAccountRepository accounts, NickPolicy nickPolicy,
                        ApplicationEventPublisher events, CasinoProperties properties) {
        this.accounts = accounts;
        this.nickPolicy = nickPolicy;
        this.events = events;
        this.properties = properties;
    }

    /**
     * Loguje gracza o podanej nazwie, a gdy go nie ma, tworzy konto z portfelem i bonusem powitalnym.
     *
     * @throws pl.wsb.kasyno.account.domain.InvalidNickException gdy nazwa nie spełnia reguł
     */
    @Transactional
    public LoginResult login(String rawNick) {
        String nick = nickPolicy.validate(rawNick);
        String email = technicalEmail(nick);
        return accounts.findByEmail(email)
                .map(existing -> new LoginResult(existing.getId(), false, BigDecimal.ZERO))
                .orElseGet(() -> register(nick, email));
    }

    private LoginResult register(String nick, String email) {
        UserAccount account = accounts.save(new UserAccount(email, nick, AccountRole.USER));
        BigDecimal bonus = properties.welcomeBonus();
        events.publishEvent(new PlayerRegistered(account.getId(), nick, bonus));
        return new LoginResult(account.getId(), true, bonus);
    }

    /** {@code Kamil_77} → {@code kamil_77@kasyno.local}. {@code Locale.ROOT}: wynik nie zależy od języka systemu. */
    static String technicalEmail(String nick) {
        return nick.toLowerCase(Locale.ROOT) + TECHNICAL_EMAIL_DOMAIN;
    }
}
