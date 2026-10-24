package pl.wsb.kasyno.slots.entity;

/**
 * Rodzaj symbolu na bębnie.
 */
public enum SymbolKind {

    /** Zwykły symbol płacący według tabeli wypłat. */
    NORMAL,
    /** Dziki symbol: zastępuje inne symbole na linii. */
    WILD,
    /** Symbol rozproszony: płaci lub uruchamia darmowe spiny niezależnie od linii. */
    SCATTER,
    /** Kula mnożnika (Kryształowa Kaskada): mnoży wygraną sekwencji kaskad. */
    MULTIPLIER
}
