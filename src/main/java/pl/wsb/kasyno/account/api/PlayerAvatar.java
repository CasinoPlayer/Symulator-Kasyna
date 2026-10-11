package pl.wsb.kasyno.account.api;

import java.util.Locale;

/**
 * Numer awatara gracza (0–7) wyliczany z nazwy.
 *
 * <p>Po co: nie przechowujemy awatara w bazie (tabela {@code user_account} pochodzi z szablonu i jej nie
 * zmieniamy), a ten sam gracz ma zawsze ten sam obrazek: w rankingu, w feedzie wygranych i w prawym górnym rogu.
 * {@link String#hashCode()} ma algorytm zapisany w specyfikacji Javy, więc wynik jest taki sam na każdym
 * komputerze i po każdym restarcie. Nazwę zamieniamy na małe litery, bo „Kamil” i „KAMIL” to ten sam gracz.
 */
public final class PlayerAvatar {

    /** Liczba awatarów w arkuszu {@code g_awatary} (siatka 4×2). */
    public static final int COUNT = 8;

    private PlayerAvatar() {
    }

    public static int indexFor(String nick) {
        if (nick == null) {
            return 0;
        }
        return Math.floorMod(nick.toLowerCase(Locale.ROOT).hashCode(), COUNT);
    }
}
