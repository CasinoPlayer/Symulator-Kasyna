package pl.wsb.kasyno.account.application;

import org.springframework.stereotype.Component;
import pl.wsb.kasyno.account.domain.InvalidNickException;
import pl.wsb.kasyno.shared.config.CasinoProperties;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Reguły nazwy gracza (kontrakt API, kod {@code NICK_INVALID} / {@code NICK_FORBIDDEN}).
 *
 * <ol>
 *   <li>obcinamy spacje z początku i końca;</li>
 *   <li>długość 3–16 znaków (z {@link CasinoProperties.Nick});</li>
 *   <li>dozwolone znaki: litery łacińskie i polskie, cyfry, {@code _} i {@code -}. Lista jest jawna (a nie
 *       „dowolna litera Unicode”), żeby nie dało się podszyć pod kogoś literą z innego alfabetu, która wygląda
 *       identycznie (np. cyrylickie „а” zamiast łacińskiego „a”);</li>
 *   <li>nazwy zastrzeżone ({@code admin}, {@code krupier}…) porównujemy w całości, a wulgaryzmy wyszukujemy
 *       jako fragment. Przed porównaniem nazwę „upraszczamy”: małe litery, bez polskich znaków, cyfry jak litery
 *       ({@code 4→a}, {@code 0→o}…), bez {@code _} i {@code -}, bez powtórzeń liter. Dzięki temu
 *       {@code Adm1n} czy {@code A_d_m_i_n} też są odrzucane.</li>
 * </ol>
 */
@Component
public class NickPolicy {

    private static final Pattern ALLOWED_CHARACTERS = Pattern.compile("[A-Za-z0-9_\\-ĄĆĘŁŃÓŚŹŻąćęłńóśźż]+");
    private static final Pattern DIACRITIC_MARKS = Pattern.compile("\\p{M}+");

    private final CasinoProperties.Nick rules;
    private final List<String> reservedNames;
    private final List<String> forbiddenWords;

    public NickPolicy(CasinoProperties properties) {
        this.rules = properties.nick();
        // listy z konfiguracji upraszczamy tak samo jak nazwy graczy, żeby porównanie było uczciwe
        this.reservedNames = rules.reservedNames().stream().map(NickPolicy::simplify).filter(s -> !s.isEmpty()).toList();
        this.forbiddenWords = rules.forbiddenWords().stream().map(NickPolicy::simplify).filter(s -> !s.isEmpty()).toList();
    }

    /**
     * Sprawdza nazwę i zwraca ją po obcięciu spacji.
     *
     * @throws InvalidNickException gdy nazwa nie spełnia reguł
     */
    public String validate(String rawNick) {
        String nick = rawNick == null ? "" : rawNick.strip();
        if (nick.length() < rules.minLength() || nick.length() > rules.maxLength()) {
            throw InvalidNickException.invalid("Nazwa gracza musi mieć od %d do %d znaków."
                    .formatted(rules.minLength(), rules.maxLength()));
        }
        if (!ALLOWED_CHARACTERS.matcher(nick).matches()) {
            throw InvalidNickException.invalid(
                    "Nazwa gracza może zawierać tylko litery (także polskie), cyfry oraz znaki _ i -.");
        }
        String simplified = simplify(nick);
        boolean reserved = reservedNames.contains(simplified);
        boolean vulgar = forbiddenWords.stream().anyMatch(simplified::contains);
        if (reserved || vulgar) {
            throw InvalidNickException.forbidden();
        }
        return nick;
    }

    /** Uproszczona postać nazwy do porównań z listami słów (opis w Javadoc klasy). */
    static String simplify(String text) {
        String lower = text.toLowerCase(Locale.ROOT).replace('ł', 'l');
        String withoutDiacritics = DIACRITIC_MARKS.matcher(Normalizer.normalize(lower, Normalizer.Form.NFD)).replaceAll("");
        StringBuilder result = new StringBuilder(withoutDiacritics.length());
        for (char c : withoutDiacritics.toCharArray()) {
            char mapped = switch (c) {
                case '0' -> 'o';
                case '1' -> 'i';
                case '3' -> 'e';
                case '4' -> 'a';
                case '5' -> 's';
                case '7' -> 't';
                case '8' -> 'b';
                case '@' -> 'a';
                case '$' -> 's';
                default -> c;
            };
            boolean separator = mapped == '_' || mapped == '-' || Character.isWhitespace(mapped);
            boolean repeated = !result.isEmpty() && result.charAt(result.length() - 1) == mapped;
            if (!separator && !repeated) {
                result.append(mapped);
            }
        }
        return result.toString();
    }
}
