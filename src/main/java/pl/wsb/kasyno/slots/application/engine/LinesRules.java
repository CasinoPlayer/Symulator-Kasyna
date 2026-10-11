package pl.wsb.kasyno.slots.application.engine;

/**
 * Zasady gry liniowej, które nie są „danymi” (te są w {@code data.sql}: symbole, wypłaty, taśmy, linie), tylko
 * regułami funkcji specjalnych. Jeden {@link LinesEngine} obsługuje dwie różne gry właśnie dzięki temu rekordowi:
 * <ul>
 *   <li>Cebulowy 777: {@code wildLineMultiplier = 2} („neonowy mnożnik”), {@code fullScreenMultiplier = 10}
 *       („NEON JACKPOT”), bez darmowych spinów, limit 1 000×;</li>
 *   <li>Złoty Faraon: darmowe spiny z rozszerzającym się WILD i wygranymi ×2, limit 5 000×.</li>
 * </ul>
 *
 * @param wildLineMultiplier       mnożnik wygranej linii, na której WILD zastąpił symbol (1 = brak)
 * @param fullScreenMultiplier     mnożnik, gdy cała siatka to jeden symbol (z WILD); 0 albo 1 = funkcja wyłączona
 * @param freeSpins                zasady darmowych spinów albo {@code null} (gra bez darmowych spinów)
 * @param expandingWildInFreeSpins czy w darmowych spinach WILD rozszerza się na cały bęben
 * @param freeSpinWinMultiplier    mnożnik wygranych liniowych w darmowych spinach (1 = brak)
 * @param maxWinMultiplier         maksymalna wygrana rundy jako wielokrotność zakładu
 * @param anticipation             kiedy front ma spowolnić ostatnie bębny („prawie wygrana”)
 */
public record LinesRules(int wildLineMultiplier, int fullScreenMultiplier, FreeSpinsRules freeSpins,
                         boolean expandingWildInFreeSpins, int freeSpinWinMultiplier, int maxWinMultiplier,
                         Anticipation anticipation) {

    public LinesRules {
        if (wildLineMultiplier < 1 || freeSpinWinMultiplier < 1 || maxWinMultiplier < 1 || anticipation == null) {
            throw new IllegalArgumentException("Niepoprawne zasady gry liniowej");
        }
    }

    /** Reguła antycypacji (zdarzenie E27 z briefu: spowolnienie bębnów, gdy „prawie” jest bonus). */
    public enum Anticipation {
        /** Bez spowolnienia. */
        NONE,
        /** S1: na jakiejś linii WILD stoi na wszystkich bębnach poza ostatnim → spowolnij ostatni bęben. */
        WILDS_ON_LINE,
        /** S2: o jeden scatter za mało do darmowych spinów → spowolnij wszystkie kolejne bębny. */
        SCATTERS
    }
}
