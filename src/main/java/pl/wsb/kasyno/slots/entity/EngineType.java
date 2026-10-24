package pl.wsb.kasyno.slots.entity;

/**
 * Sposób liczenia wygranych automatu.
 */
public enum EngineType {

    /** Klasyczne linie wygrywające (Cebulowy 777: 5 linii, Złoty Faraon: 20 linii). */
    LINES,
    /** Klastry, czyli grupy 5+ takich samych symboli stykających się bokami (Kryształowa Kaskada). */
    CLUSTER
}
