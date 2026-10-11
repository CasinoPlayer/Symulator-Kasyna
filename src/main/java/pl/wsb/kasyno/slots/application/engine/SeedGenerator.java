package pl.wsb.kasyno.slots.application.engine;

/**
 * Źródło ziaren losowania rund.
 *
 * <p>Interfejs (a nie {@code new SecureRandom()} w serwisie), żeby test albo profil {@code demo} mógł podać
 * przewidywalne ziarna (np. do nagrania filmiku z dużą wygraną), a produkcja używała {@link SecureSeedGenerator}.
 */
@FunctionalInterface
public interface SeedGenerator {

    long nextSeed();
}
