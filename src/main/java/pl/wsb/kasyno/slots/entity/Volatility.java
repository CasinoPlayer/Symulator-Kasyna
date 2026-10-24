package pl.wsb.kasyno.slots.entity;

/**
 * Zmienność automatu: jak często i jak duże są wygrane przy tym samym RTP. Niska zmienność to częste małe
 * wygrane, wysoka to rzadkie, ale duże.
 */
public enum Volatility {
    LOW_MEDIUM,
    MEDIUM_HIGH,
    HIGH
}
