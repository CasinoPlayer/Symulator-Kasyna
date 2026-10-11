package pl.wsb.kasyno.slots.application.engine;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Trzy silniki gier jako beany Springa i reguły ich funkcji specjalnych w jednym miejscu.
 *
 * <p>Podział odpowiedzialności:
 * <ul>
 *   <li><b>dane gry</b> (symbole, wagi, wypłaty, taśmy bębnów, linie) są w {@code data.sql} i trafiają do silnika
 *       przez {@link GameMathProvider}; zmiana tabeli wypłat nie wymaga zmiany kodu;</li>
 *   <li><b>reguły funkcji</b> (mnożniki, darmowe spiny, limit wygranej) są tutaj, jako stałe: to część „zasad gry”
 *       opisanych w {@code docs/projekt/07-gry-i-matematyka.md}, a testy RTP używają dokładnie tych stałych;</li>
 *   <li><b>algorytm</b> jest wspólny: {@link LinesEngine} obsługuje S1 i S2, {@link ClusterEngine} obsługuje S3.</li>
 * </ul>
 * {@link SlotEngineRegistry} zbiera te beany sam (po kodzie gry), więc {@code SpinService} nie zna konkretnych gier.
 */
@Configuration
public class SlotEnginesConfig {

    public static final String CEBULOWY_777 = "cebulowy-777";
    public static final String ZLOTY_FARAON = "zloty-faraon";
    public static final String KRYSZTALOWA_KASKADA = "krysztalowa-kaskada";

    /**
     * S1 Cebulowy 777: „neonowy mnożnik” (wygrana linii z WILD ×2), NEON JACKPOT (cała plansza jednego symbolu
     * z WILD: wygrana linii ×10), bez darmowych spinów, limit 1 000× zakładu, antycypacja: 2 WILD na linii.
     */
    public static final LinesRules CEBULOWY_777_RULES = new LinesRules(2, 10, null, false, 1, 1_000,
            LinesRules.Anticipation.WILDS_ON_LINE);

    /**
     * S2 Złoty Faraon: 3+ scattery → 10 darmowych spinów; w nich WILD rozszerza się na bęben, wygrane liniowe ×2,
     * 3 scattery = +10 spinów (łącznie najwyżej 50); limit 5 000× zakładu; antycypacja: 2 scattery.
     */
    public static final LinesRules ZLOTY_FARAON_RULES = new LinesRules(1, 0,
            new FreeSpinsRules(3, 10, 3, 10, 50), true, 2, 5_000, LinesRules.Anticipation.SCATTERS);

    /**
     * S3 Kryształowa Kaskada: klastry 5+, 4+ scattery → 10 darmowych spinów, 3 scattery w nich = +5 (łącznie
     * najwyżej 50); kule mnożników ×2…×100 z malejącym prawdopodobieństwem; limit 10 000× zakładu.
     */
    public static final ClusterRules KRYSZTALOWA_KASKADA_RULES = new ClusterRules(5,
            new FreeSpinsRules(4, 10, 3, 5, 50),
            // wagi sumują się do 857: ×2 wypada w 17,5% kul, ×100 w 1,4% (średnia wartość kuli ≈ 9,1)
            List.of(
                    new ClusterRules.OrbValue(2, 150),
                    new ClusterRules.OrbValue(3, 150),
                    new ClusterRules.OrbValue(4, 120),
                    new ClusterRules.OrbValue(5, 120),
                    new ClusterRules.OrbValue(8, 100),
                    new ClusterRules.OrbValue(10, 80),
                    new ClusterRules.OrbValue(15, 60),
                    new ClusterRules.OrbValue(25, 40),
                    new ClusterRules.OrbValue(50, 25),
                    new ClusterRules.OrbValue(100, 12)),
            10_000);

    @Bean
    SlotEngine cebulowy777Engine(GameMathProvider mathProvider) {
        return new LinesEngine(CEBULOWY_777, CEBULOWY_777_RULES, mathProvider);
    }

    @Bean
    SlotEngine zlotyFaraonEngine(GameMathProvider mathProvider) {
        return new LinesEngine(ZLOTY_FARAON, ZLOTY_FARAON_RULES, mathProvider);
    }

    @Bean
    SlotEngine krysztalowaKaskadaEngine(GameMathProvider mathProvider) {
        return new ClusterEngine(KRYSZTALOWA_KASKADA, KRYSZTALOWA_KASKADA_RULES, mathProvider);
    }
}
