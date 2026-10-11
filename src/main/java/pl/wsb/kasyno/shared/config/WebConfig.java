package pl.wsb.kasyno.shared.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import pl.wsb.kasyno.shared.web.CurrentPlayerArgumentResolver;

import java.time.Duration;
import java.util.List;

/**
 * Konfiguracja Spring MVC: własny resolver parametru {@code @CurrentPlayer} i nagłówki cache dla assetów.
 *
 * <p>Cache: obrazy, dźwięki i wideo z {@code /assets/**} rzadko się zmieniają i są największą częścią transferu,
 * więc przeglądarka może je trzymać przez dobę bez pytania serwera ({@code Cache-Control: public, max-age=86400}),
 * a potem odświeża je tanim zapytaniem warunkowym ({@code Last-Modified} → {@code 304 Not Modified}).
 * Wyjątkiem są pliki {@code manifest.json}: to „spis treści” assetów z polem {@code version}, więc zawsze
 * sprawdzamy jego świeżość ({@code no-cache}), żeby podmiana grafiki od razu była widoczna.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private static final String ASSETS_LOCATION = "classpath:/static/assets/";

    private final CurrentPlayerArgumentResolver currentPlayerArgumentResolver;

    public WebConfig(CurrentPlayerArgumentResolver currentPlayerArgumentResolver) {
        this.currentPlayerArgumentResolver = currentPlayerArgumentResolver;
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(currentPlayerArgumentResolver);
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // bardziej szczegółowy wzorzec wygrywa z /assets/**, więc manifesty dostają własne nagłówki
        registry.addResourceHandler("/assets/*/manifest.json")
                .addResourceLocations(ASSETS_LOCATION)
                .setCacheControl(CacheControl.noCache());
        registry.addResourceHandler("/assets/**")
                .addResourceLocations(ASSETS_LOCATION)
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic());
    }
}
