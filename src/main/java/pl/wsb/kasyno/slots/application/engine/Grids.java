package pl.wsb.kasyno.slots.application.engine;

import java.util.ArrayList;
import java.util.List;

/**
 * Drobne operacje na siatce {@code int[bęben][rząd]} wspólne dla obu silników: zamiana na kody symboli, pozycje
 * scatterów, antycypacja. Klasa narzędziowa pakietu (bez stanu).
 */
final class Grids {

    private Grids() {
    }

    /** Siatka kodów symboli do JSON ({@code grid[bęben][rząd]}). */
    static String[][] codes(GameMath math, int[][] grid) {
        String[][] codes = new String[grid.length][];
        for (int reel = 0; reel < grid.length; reel++) {
            codes[reel] = new String[grid[reel].length];
            for (int row = 0; row < grid[reel].length; row++) {
                codes[reel][row] = math.code(grid[reel][row]);
            }
        }
        return codes;
    }

    /** Pozycje {@code [bęben, rząd]} wszystkich wystąpień symbolu (kolejno bęben po bębnie, od góry). */
    static int[][] positionsOf(int[][] grid, int symbol) {
        if (symbol == GameMath.NONE) {
            return new int[0][];
        }
        List<int[]> positions = new ArrayList<>();
        for (int reel = 0; reel < grid.length; reel++) {
            for (int row = 0; row < grid[reel].length; row++) {
                if (grid[reel][row] == symbol) {
                    positions.add(new int[]{reel, row});
                }
            }
        }
        return positions.toArray(new int[0][]);
    }

    /**
     * Antycypacja scatterów: bębny zatrzymują się od lewej; gdy na dotychczasowych bębnach jest już
     * {@code threshold} scatterów (o jeden mniej niż potrzeba do funkcji), wszystkie kolejne bębny mają zwolnić.
     */
    static List<Integer> scatterAnticipation(int[][] grid, int scatter, int threshold) {
        if (scatter == GameMath.NONE || threshold <= 0) {
            return List.of();
        }
        int seen = 0;
        for (int reel = 0; reel < grid.length - 1; reel++) {
            for (int symbol : grid[reel]) {
                if (symbol == scatter) {
                    seen++;
                }
            }
            if (seen >= threshold) {
                List<Integer> slowed = new ArrayList<>();
                for (int next = reel + 1; next < grid.length; next++) {
                    slowed.add(next);
                }
                return slowed;
            }
        }
        return List.of();
    }
}
