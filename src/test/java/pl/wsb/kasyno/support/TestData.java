package pl.wsb.kasyno.support;

import org.springframework.test.util.ReflectionTestUtils;
import pl.wsb.kasyno.account.domain.AccountRole;
import pl.wsb.kasyno.account.domain.UserAccount;
import pl.wsb.kasyno.shared.config.CasinoProperties;
import pl.wsb.kasyno.shared.domain.Money;
import pl.wsb.kasyno.slots.entity.BetLevels;
import pl.wsb.kasyno.slots.entity.EngineType;
import pl.wsb.kasyno.slots.entity.SlotMachine;
import pl.wsb.kasyno.slots.entity.Volatility;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;

/**
 * Wspólne dane testowe: konfiguracja kasyna jak w {@code application.properties}, gracze i automaty.
 */
public final class TestData {

    private TestData() {
    }

    public static CasinoProperties properties() {
        return new CasinoProperties(
                Money.of(10_000),
                Money.of(10_000),
                Duration.ofMinutes(10),
                BigDecimal.valueOf(15),
                new CasinoProperties.Nick(3, 16,
                        List.of("admin", "administrator", "krupier", "cebulion"),
                        List.of("kurw", "chuj", "pierdol")),
                new CasinoProperties.Lobby(Duration.ofSeconds(30)),
                new CasinoProperties.Schedule(false, "0 0 * * * *", "0 30 * * * *", Duration.ofHours(24)),
                new CasinoProperties.Demo(false),
                new CasinoProperties.StarterData(false));
    }

    public static UserAccount player(String nick) {
        return new UserAccount(nick.toLowerCase() + "@kasyno.local", nick, AccountRole.USER);
    }

    /** Gracz z ustawionym identyfikatorem (w testach bez bazy id nie nada się samo). */
    public static UserAccount player(long id, String nick) {
        UserAccount account = player(nick);
        ReflectionTestUtils.setField(account, "id", id);
        return account;
    }

    public static SlotMachine cebulowy777() {
        return new SlotMachine("cebulowy-777", "Cebulowy 777", EngineType.LINES, 3, 3, 5,
                BetLevels.parse("10,20,50,100,200,500,1000"), new BigDecimal("95.00"), Volatility.LOW_MEDIUM,
                "WILD zastępuje każdy symbol|NEON JACKPOT ×10");
    }

    public static SlotMachine kaskada() {
        return new SlotMachine("krysztalowa-kaskada", "Kryształowa Kaskada", EngineType.CLUSTER, 6, 5, null,
                BetLevels.parse("20,40,100,200,400,1000,2000"), new BigDecimal("96.00"), Volatility.HIGH, null);
    }

    public static <T> T withId(T entity, long id) {
        ReflectionTestUtils.setField(entity, "id", id);
        return entity;
    }
}
