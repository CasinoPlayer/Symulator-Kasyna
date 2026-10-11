package pl.wsb.kasyno.shared.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.PropertiesLoaderUtils;

import java.io.IOException;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pliki profili ({@code application-<profil>.properties}) zawierają to, co obiecuje dokumentacja. Test czyta same pliki
 * (bez startu aplikacji), więc pilnuje m.in., żeby nikt przez pomyłkę nie włączył {@code X-Demo-Seed} poza demo.
 */
@DisplayName("LAB 06: profile dev / demo / prod")
class ProfilesTest {

    private static Properties load(String file) throws IOException {
        return PropertiesLoaderUtils.loadProperties(new ClassPathResource(file));
    }

    @Test
    @DisplayName("domyślny profil to dev, a ustawienia wspólne są jak w szablonie (create-drop, data.sql, H2 w pliku)")
    void defaultProfileIsDev() throws IOException {
        Properties base = load("application.properties");

        assertThat(base.getProperty("spring.profiles.default")).isEqualTo("dev");
        assertThat(base.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("create-drop");
        assertThat(base.getProperty("spring.sql.init.mode")).isEqualTo("always");
        assertThat(base.getProperty("spring.datasource.url")).startsWith("jdbc:h2:file:./data/wdtb");
        assertThat(base.getProperty("kasyno.demo.allow-seed")).isEqualTo("false");
    }

    @Test
    @DisplayName("dev nie nadpisuje ustawień szablonu (zmiany z instrukcji laboratoriów w application.properties działają)")
    void devDoesNotOverrideTemplate() throws IOException {
        Properties dev = load("application-dev.properties");

        assertThat(dev.stringPropertyNames()).containsExactly("kasyno.demo.allow-seed");
        assertThat(dev.getProperty("kasyno.demo.allow-seed")).isEqualTo("false");
    }

    @Test
    @DisplayName("X-Demo-Seed włączony WYŁĄCZNIE w profilu demo")
    void demoSeedOnlyInDemo() throws IOException {
        assertThat(load("application-demo.properties").getProperty("kasyno.demo.allow-seed")).isEqualTo("true");
        assertThat(load("application-prod.properties").getProperty("kasyno.demo.allow-seed")).isEqualTo("false");
        assertThat(load("application-dev.properties").getProperty("kasyno.demo.allow-seed")).isEqualTo("false");
        assertThat(load("application-test.properties").getProperty("kasyno.demo.allow-seed")).isNull();
    }

    @Test
    @DisplayName("prod: trwała baza (update), data.sql tylko przy pustej bazie, bez konsoli H2, port z PORT")
    void prodIsPersistent() throws IOException {
        Properties prod = load("application-prod.properties");

        assertThat(prod.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("update");
        assertThat(prod.getProperty("spring.sql.init.mode")).isEqualTo("never");
        assertThat(prod.getProperty("kasyno.starter-data.load-when-empty")).isEqualTo("true");
        assertThat(prod.getProperty("spring.h2.console.enabled")).isEqualTo("false");
        assertThat(prod.getProperty("server.port")).isEqualTo("${PORT:8080}");
        assertThat(prod.getProperty("spring.datasource.url")).startsWith("jdbc:h2:file:").doesNotContain("wdtb");
    }
}
