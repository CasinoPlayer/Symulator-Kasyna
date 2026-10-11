package pl.wsb.kasyno.shared.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;

/**
 * Wczytuje {@code data.sql} przy pierwszym starcie na trwałej bazie (profil {@code prod}).
 *
 * <p>Problem: w profilu domyślnym (jak w szablonie kursu) Hibernate tworzy tabele od nowa przy każdym starcie
 * ({@code ddl-auto=create-drop}), a Spring Boot zaraz potem wczytuje {@code data.sql} ({@code spring.sql.init.mode=always}).
 * W profilu {@code prod} baza ma przetrwać restart ({@code ddl-auto=update}), więc ponowne wczytanie skryptu przy
 * każdym starcie dopisywałoby duplikaty (a unikalne kolumny, np. {@code slot_machine.code}, zatrzymałyby start).
 * Z drugiej strony przy pierwszym starcie na pustej bazie automaty muszą się pojawić, inaczej nie ma w co grać.
 *
 * <p>Rozwiązanie: {@code prod} wyłącza wbudowane wczytywanie ({@code spring.sql.init.mode=never}) i włącza tę klasę
 * ({@code kasyno.starter-data.load-when-empty=true}). Po starcie aplikacji sprawdzamy, czy tabela
 * {@code slot_machine} jest pusta; tylko wtedy wykonujemy ten sam {@code data.sql} (konta zespołu i trzy automaty).
 * Skrypt jest jeden dla wszystkich profili, więc dane w {@code prod} są takie same jak na zajęciach.
 *
 * <p>Dlaczego {@link ApplicationRunner}: uruchamia się raz, gdy kontekst Springa jest gotowy, a więc po tym, jak
 * Hibernate utworzył albo uzupełnił tabele. Zwykłe zapytania SQL ({@link JdbcTemplate}) zamiast repozytoriów,
 * bo moduł {@code shared} nie zna encji innych modułów (pilnuje tego test architektury).
 */
@Component
@Order(0)
public class StarterDataLoader implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(StarterDataLoader.class);

    /** Ten sam plik, który w profilu domyślnym wczytuje Spring Boot. */
    static final String SCRIPT = "data.sql";

    private final DataSource dataSource;
    private final CasinoProperties properties;

    public StarterDataLoader(DataSource dataSource, CasinoProperties properties) {
        this.dataSource = dataSource;
        this.properties = properties;
    }

    @Override
    public void run(ApplicationArguments args) {
        loadIfEmpty();
    }

    /**
     * Wczytuje dane startowe, jeśli są włączone i baza nie ma jeszcze automatów.
     *
     * @return {@code true}, gdy skrypt został wykonany
     */
    public boolean loadIfEmpty() {
        if (!properties.starterData().loadWhenEmpty()) {
            return false;
        }
        Integer machines = new JdbcTemplate(dataSource).queryForObject("select count(*) from slot_machine", Integer.class);
        if (machines != null && machines > 0) {
            log.info("Dane startowe już są w bazie ({} automaty), {} pominięty", machines, SCRIPT);
            return false;
        }
        Resource script = new ClassPathResource(SCRIPT);
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator(script);
        // data.sql zawiera polskie znaki (np. „Złoty Faraon”), tak samo jak spring.sql.init.encoding=UTF-8
        populator.setSqlScriptEncoding(StandardCharsets.UTF_8.name());
        populator.execute(dataSource);
        log.info("Pusta baza: wczytano dane startowe z {} (konta zespołu i automaty)", SCRIPT);
        return true;
    }
}
