package pl.wsb.kasyno.shared.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.config.CronTask;
import org.springframework.scheduling.config.ScheduledTask;
import org.springframework.scheduling.config.ScheduledTaskHolder;
import pl.wsb.kasyno.KasynoApplication;
import pl.wsb.kasyno.account.application.LoginService;
import pl.wsb.kasyno.shared.domain.Money;
import pl.wsb.kasyno.slots.application.SpinCommand;
import pl.wsb.kasyno.slots.application.SpinService;
import pl.wsb.kasyno.wallet.api.WalletFacade;

import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Profil {@code prod} na prawdziwej bazie H2 w pliku (katalog tymczasowy), uruchomiony dwa razy z rzędu, jak serwer
 * po restarcie: przy pierwszym starcie {@code data.sql} wczytuje automaty i konta zespołu, przy drugim dane graczy
 * zostają, a automaty się nie dublują. Przy okazji: z włączonym harmonogramem oba zadania {@code @Scheduled} są
 * zarejestrowane z cronami z konfiguracji (sprawdzamy rejestrację, nie czekamy na godzinę).
 */
@DisplayName("Profil prod: trwała baza, data.sql tylko przy pierwszym starcie, zadania @Scheduled")
class ProdProfilePersistenceTest {

    private static ConfigurableApplicationContext startProd(Path dir, boolean scheduling) {
        return new SpringApplicationBuilder(KasynoApplication.class)
                .profiles("prod")
                .web(WebApplicationType.NONE)
                .run("--spring.datasource.url=jdbc:h2:file:" + dir.resolve("kasyno-prod").toAbsolutePath()
                                + ";DATABASE_TO_LOWER=TRUE",
                        "--kasyno.schedule.enabled=" + scheduling,
                        "--spring.main.banner-mode=off",
                        "--logging.level.root=WARN");
    }

    private static int count(ConfigurableApplicationContext context, String table) {
        Integer value = context.getBean(JdbcTemplate.class).queryForObject("select count(*) from " + table, Integer.class);
        return value == null ? 0 : value;
    }

    @Test
    @DisplayName("restart: automaty raz (3), konta zespołu raz, gracz i jego saldo po restarcie zostają")
    void survivesRestart(@TempDir Path dir) {
        Long playerId;
        BigDecimal balance;
        int accountsAfterFirstStart;
        try (ConfigurableApplicationContext first = startProd(dir, false)) {
            assertThat(count(first, "slot_machine")).isEqualTo(3);
            assertThat(count(first, "slot_symbol")).isPositive();
            accountsAfterFirstStart = count(first, "user_account");
            assertThat(accountsAfterFirstStart).isGreaterThanOrEqualTo(7);

            playerId = first.getBean(LoginService.class).login("Trwaly_Gracz").playerId();
            first.getBean(SpinService.class).spin(new SpinCommand(playerId, "cebulowy-777", Money.of(100), "k1"));
            balance = first.getBean(WalletFacade.class).balance(playerId);
        }

        try (ConfigurableApplicationContext second = startProd(dir, false)) {
            assertThat(count(second, "slot_machine")).isEqualTo(3);
            assertThat(count(second, "user_account")).isEqualTo(accountsAfterFirstStart + 1);
            assertThat(count(second, "spin_round")).isEqualTo(1);
            assertThat(second.getBean(WalletFacade.class).balance(playerId)).isEqualByComparingTo(balance);
            assertThat(second.getBean(StarterDataLoader.class).loadIfEmpty()).isFalse();
        }
    }

    @Test
    @DisplayName("harmonogram włączony: migawka gospodarki (co godzinę) i sprzątanie kluczy zarejestrowane")
    void scheduledTasksRegistered(@TempDir Path dir) {
        try (ConfigurableApplicationContext context = startProd(dir, true)) {
            List<String> crons = context.getBeansOfType(ScheduledTaskHolder.class).values().stream()
                    .flatMap(holder -> holder.getScheduledTasks().stream())
                    .map(ScheduledTask::getTask)
                    .filter(CronTask.class::isInstance)
                    .map(task -> ((CronTask) task).getExpression() + " → " + task.getRunnable())
                    .toList();

            assertThat(crons).anySatisfy(c -> assertThat(c).startsWith("0 0 * * * *").contains("EconomySnapshotJob.logSnapshot"));
            assertThat(crons).anySatisfy(c -> assertThat(c).startsWith("0 30 * * * *").contains("IdempotencyKeyCleanup.forgetExpiredKeys"));
        }
    }
}
