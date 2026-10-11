package pl.wsb.kasyno.report.application;

import java.util.Arrays;

/**
 * Rodzaj rankingu z parametru {@code ?type=} ({@code biggest-win} albo {@code balance}).
 */
public enum LeaderboardType {

    /** Największa pojedyncza wygrana gracza. */
    BIGGEST_WIN("biggest-win"),
    /** Najwyższe saldo. */
    BALANCE("balance");

    private final String param;

    LeaderboardType(String param) {
        this.param = param;
    }

    public String param() {
        return param;
    }

    public static LeaderboardType fromParam(String value) {
        return Arrays.stream(values())
                .filter(type -> type.param.equalsIgnoreCase(value))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Nieznany rodzaj rankingu: " + value));
    }
}
