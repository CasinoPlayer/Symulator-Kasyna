package pl.wsb.kasyno.shared.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * Zegar aplikacji jako bean.
 *
 * <p>Po co: serwisy nie wołają {@code Instant.now()}, tylko {@code Instant.now(clock)}. W testach podajemy zegar
 * ustawiony na konkretną chwilę i możemy „przesunąć czas” (np. sprawdzić, że bonus ratunkowy odblokuje się po
 * 10 minutach), bez czekania i bez losowych wyników testów. Zegar działa w UTC: daty w bazie i w API
 * są w UTC, a przeliczenie na czas lokalny robi przeglądarka.
 */
@Configuration
public class TimeConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
