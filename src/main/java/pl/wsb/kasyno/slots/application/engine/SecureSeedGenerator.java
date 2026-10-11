package pl.wsb.kasyno.slots.application.engine;

import org.springframework.stereotype.Component;

import java.security.SecureRandom;

/**
 * Ziarna z kryptograficznie bezpiecznego generatora {@link SecureRandom}: nie da się przewidzieć ziarna następnej
 * rundy na podstawie poprzednich (zwykły {@code java.util.Random} jest przewidywalny po kilku obserwacjach).
 */
@Component
public class SecureSeedGenerator implements SeedGenerator {

    private final SecureRandom random = new SecureRandom();

    @Override
    public long nextSeed() {
        return random.nextLong();
    }
}
