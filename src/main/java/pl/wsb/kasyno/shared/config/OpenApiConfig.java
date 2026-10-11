package pl.wsb.kasyno.shared.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springdoc.core.utils.SpringDocUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import pl.wsb.kasyno.shared.web.CurrentPlayer;

/**
 * Opis API dla dokumentacji OpenAPI (springdoc). Swagger UI: {@code /swagger-ui.html},
 * opis maszynowy: {@code /v3/api-docs}.
 *
 * <p>Parametry z {@link CurrentPlayer} ukrywamy w dokumentacji: nie przychodzą od klienta, tylko z sesji
 * (ciasteczko), więc Swagger nie powinien pokazywać ich jako pola do wpisania.
 */
@Configuration
public class OpenApiConfig {

    static {
        SpringDocUtils.getConfig().addAnnotationsToIgnore(CurrentPlayer.class);
    }

    @Bean
    public OpenAPI kasynoOpenApi() {
        return new OpenAPI().info(new Info()
                .title("Cebulion Casino API")
                .version("1.0.0")
                .description("""
                        Symulator kasyna z wirtualną walutą „cebulion” (bez prawdziwych pieniędzy).
                        Logowanie: POST /api/auth/login z nazwą gracza ustawia ciasteczko sesji, \
                        które przeglądarka wysyła przy kolejnych żądaniach.
                        Błędy: application/problem+json z polem `code` (kontrakt: docs/projekt/09).""")
                .license(new License().name("Projekt studencki WdTB 2026")));
    }
}
