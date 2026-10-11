package pl.wsb.kasyno.account.application;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import pl.wsb.kasyno.account.domain.InvalidNickException;
import pl.wsb.kasyno.shared.error.ErrorCode;
import pl.wsb.kasyno.support.TestData;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("NickPolicy: reguły nazwy gracza")
class NickPolicyTest {

    private final NickPolicy policy = new NickPolicy(TestData.properties());

    @ParameterizedTest(name = "„{0}” jest poprawna")
    @ValueSource(strings = {"Kamil_77", "Łukasz", "żółw-123", "abc", "A234567890123456", "Ola", "Szymon", "Dawid-M"})
    void acceptsValidNicks(String nick) {
        assertThat(policy.validate(nick)).isEqualTo(nick);
    }

    @Test
    @DisplayName("obcina spacje z początku i końca")
    void trimsWhitespace() {
        assertThat(policy.validate("   Kamil_77  ")).isEqualTo("Kamil_77");
    }

    @ParameterizedTest(name = "„{0}” → NICK_INVALID")
    @ValueSource(strings = {"", "  ", "ab", "A2345678901234567", "a b", "kamil!", "Ваня", "kamil.77", "emoji😀"})
    void rejectsInvalidNicks(String nick) {
        assertThatThrownBy(() -> policy.validate(nick))
                .isInstanceOf(InvalidNickException.class)
                .extracting(e -> ((InvalidNickException) e).getCode())
                .isEqualTo(ErrorCode.NICK_INVALID);
    }

    @Test
    @DisplayName("brak nazwy (null) → NICK_INVALID")
    void rejectsNull() {
        assertThatThrownBy(() -> policy.validate(null))
                .isInstanceOf(InvalidNickException.class)
                .extracting(e -> ((InvalidNickException) e).getCode())
                .isEqualTo(ErrorCode.NICK_INVALID);
    }

    @ParameterizedTest(name = "„{0}” → NICK_FORBIDDEN")
    @ValueSource(strings = {"admin", "ADMIN", "Adm1n", "a_d_m_i_n", "Krupier", "Cebulion", "kurwa123", "xXchujXx",
            "Kuuurwa", "K_U_R_W_A", "Pi3rd0l"})
    void rejectsForbiddenNicks(String nick) {
        assertThatThrownBy(() -> policy.validate(nick))
                .isInstanceOf(InvalidNickException.class)
                .extracting(e -> ((InvalidNickException) e).getCode())
                .isEqualTo(ErrorCode.NICK_FORBIDDEN);
    }

    @Test
    @DisplayName("nazwa zastrzeżona blokuje tylko całą nazwę, nie fragment (np. „Adminek” przechodzi)")
    void reservedNameMustMatchWhole() {
        assertThat(policy.validate("Adminek")).isEqualTo("Adminek");
    }

    @ParameterizedTest(name = "uproszczenie „{0}” = „{1}”")
    @CsvSource({"Adm1n,admin", "A_d_m_i_n,admin", "ŁÓDŹ,lodz", "Kuuurwa,kurwa", "C3bul10n,cebulion"})
    void simplifiesForComparison(String input, String expected) {
        assertThat(NickPolicy.simplify(input)).isEqualTo(expected);
    }
}
