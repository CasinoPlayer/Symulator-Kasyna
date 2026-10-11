package pl.wsb.kasyno.account.application;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;
import pl.wsb.kasyno.account.api.PlayerRegistered;
import pl.wsb.kasyno.account.domain.AccountRole;
import pl.wsb.kasyno.account.domain.InvalidNickException;
import pl.wsb.kasyno.account.domain.UserAccount;
import pl.wsb.kasyno.account.domain.UserAccountRepository;
import pl.wsb.kasyno.shared.domain.Money;
import pl.wsb.kasyno.support.TestData;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Test jednostkowy z Mockito: repozytorium i publikator zdarzeń są atrapami ({@code @Mock}), więc testujemy
 * samą logikę logowania, bez bazy i bez Springa.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("LoginService: logowanie nazwą gracza")
class LoginServiceTest {

    @Mock
    private UserAccountRepository accounts;
    @Mock
    private ApplicationEventPublisher events;

    private LoginService loginService;

    @BeforeEach
    void setUp() {
        loginService = new LoginService(accounts, new NickPolicy(TestData.properties()), events, TestData.properties());
    }

    @Test
    @DisplayName("nowy gracz: konto USER z technicznym e-mailem, zdarzenie PlayerRegistered z bonusem 10 000")
    void registersNewPlayerWithWelcomeBonus() {
        when(accounts.findByEmail("kamil_77@kasyno.local")).thenReturn(Optional.empty());
        when(accounts.save(any(UserAccount.class))).thenAnswer(invocation -> {
            UserAccount saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 7L);
            return saved;
        });

        LoginResult result = loginService.login("Kamil_77");

        assertThat(result.playerId()).isEqualTo(7L);
        assertThat(result.newPlayer()).isTrue();
        assertThat(result.welcomeBonus()).isEqualByComparingTo("10000");

        ArgumentCaptor<UserAccount> account = ArgumentCaptor.forClass(UserAccount.class);
        verify(accounts).save(account.capture());
        assertThat(account.getValue().getEmail()).isEqualTo("kamil_77@kasyno.local");
        assertThat(account.getValue().getDisplayName()).isEqualTo("Kamil_77");
        assertThat(account.getValue().getRole()).isEqualTo(AccountRole.USER);

        verify(events).publishEvent(new PlayerRegistered(7L, "Kamil_77", Money.of(10_000)));
    }

    @Test
    @DisplayName("powracający gracz: bez nowego konta i bez bonusu (bonus tylko raz)")
    void returningPlayerGetsNoBonus() {
        UserAccount existing = TestData.player(7L, "Kamil_77");
        when(accounts.findByEmail("kamil_77@kasyno.local")).thenReturn(Optional.of(existing));

        LoginResult result = loginService.login("Kamil_77");

        assertThat(result.playerId()).isEqualTo(7L);
        assertThat(result.newPlayer()).isFalse();
        assertThat(result.welcomeBonus()).isEqualByComparingTo(BigDecimal.ZERO);
        verify(accounts, never()).save(any());
        verifyNoInteractions(events);
    }

    @Test
    @DisplayName("wielkość liter i spacje nie mają znaczenia: „  KAMIL_77 ” to ten sam gracz")
    void lookupIsCaseInsensitive() {
        when(accounts.findByEmail("kamil_77@kasyno.local")).thenReturn(Optional.of(TestData.player(7L, "Kamil_77")));

        LoginResult result = loginService.login("  KAMIL_77 ");

        assertThat(result.playerId()).isEqualTo(7L);
        assertThat(result.newPlayer()).isFalse();
    }

    @Test
    @DisplayName("polskie litery w nazwie: e-mail małymi literami (Łukasz → łukasz@kasyno.local)")
    void polishLettersAreLowercased() {
        assertThat(LoginService.technicalEmail("ŁUKASZ")).isEqualTo("łukasz@kasyno.local");
    }

    @Test
    @DisplayName("niepoprawna nazwa: wyjątek i brak jakichkolwiek zapisów")
    void invalidNickTouchesNothing() {
        assertThatThrownBy(() -> loginService.login("a b"))
                .isInstanceOf(InvalidNickException.class);
        verifyNoInteractions(accounts, events);
    }
}
