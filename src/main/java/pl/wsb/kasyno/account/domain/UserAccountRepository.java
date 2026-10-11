package pl.wsb.kasyno.account.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Dostęp do kont użytkowników (tabela {@code user_account} z szablonu kursu).
 *
 * <p>Gracz logujący się samą nazwą dostaje techniczny e-mail {@code <nazwa-małymi-literami>@kasyno.local}.
 * Kolumna {@code email} jest unikalna, więc to baza danych gwarantuje, że „Kamil” i „KAMIL” to ten sam gracz,
 * nawet gdy dwa żądania logowania przyjdą w tej samej chwili.
 */
public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {

    /** Zapytanie pochodne (Spring Data tworzy je z nazwy metody): {@code where email = ?}. */
    Optional<UserAccount> findByEmail(String email);
}
