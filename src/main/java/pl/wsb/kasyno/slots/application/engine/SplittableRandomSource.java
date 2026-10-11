package pl.wsb.kasyno.slots.application.engine;

import java.util.SplittableRandom;

/**
 * Generator liczb losowych jednej rundy oparty na {@link SplittableRandom} z ziarna rundy.
 *
 * <p>Dlaczego dwa generatory (a nie sam {@code SecureRandom}): ziarno rundy losuje kryptograficzny
 * {@code SecureRandom} (nieprzewidywalność), a liczby w trakcie rundy daje szybki, deterministyczny
 * {@code SplittableRandom} (generator SplitMix64 o dobrych własnościach statystycznych). Dzięki temu cała runda
 * jest w pełni wyznaczona przez 64-bitowy seed zapisany w {@code spin_round.seed}, a symulacja milionów rund
 * w testach RTP trwa sekundy. {@code nextInt(bound)} jest bez obciążenia (każda wartość równie prawdopodobna).
 *
 * <p>Obiekt nie jest bezpieczny wątkowo i nie musi: każda runda ma własny egzemplarz.
 */
public final class SplittableRandomSource implements RandomSource {

    private final SplittableRandom random;

    public SplittableRandomSource(long seed) {
        this.random = new SplittableRandom(seed);
    }

    @Override
    public int nextInt(int bound) {
        return random.nextInt(bound);
    }
}
