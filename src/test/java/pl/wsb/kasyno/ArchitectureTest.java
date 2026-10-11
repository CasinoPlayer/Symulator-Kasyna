package pl.wsb.kasyno;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import jakarta.persistence.Entity;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.repository.Repository;
import org.springframework.web.bind.annotation.RestController;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

/**
 * Testy architektury (ArchUnit): pilnują granic między modułami, opisanych w planie projektu (§ 5.2).
 * Jeśli ktoś przez pomyłkę doda np. import z modułu {@code slots} do modułu {@code wallet}, test się nie powiedzie.
 *
 * <pre>
 * account  ←  wallet  ←  slots  ←  report        (strzałka: „zależy od”)
 *    ↑__________________________|
 * shared: wspólne, nie zależy od żadnego modułu
 * </pre>
 */
@DisplayName("Architektura: moduły i warstwy")
class ArchitectureTest {

    private static JavaClasses classes;

    @BeforeAll
    static void importClasses() {
        classes = new ClassFileImporter()
                .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages("pl.wsb.kasyno");
    }

    @Test
    @DisplayName("brak cykli zależności między modułami")
    void modulesAreFreeOfCycles() {
        slices().matching("pl.wsb.kasyno.(*)..").should().beFreeOfCycles().check(classes);
    }

    @Test
    @DisplayName("account nie zależy od wallet, slots ani report (jest „najniżej”)")
    void accountIsTheBase() {
        noClasses().that().resideInAPackage("pl.wsb.kasyno.account..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "pl.wsb.kasyno.wallet..", "pl.wsb.kasyno.slots..", "pl.wsb.kasyno.report..")
                .check(classes);
    }

    @Test
    @DisplayName("wallet nie zna slots ani report")
    void walletDoesNotKnowSlots() {
        noClasses().that().resideInAPackage("pl.wsb.kasyno.wallet..")
                .should().dependOnClassesThat().resideInAnyPackage("pl.wsb.kasyno.slots..", "pl.wsb.kasyno.report..")
                .check(classes);
    }

    @Test
    @DisplayName("slots korzysta z portfela tylko przez jego api")
    void slotsUsesWalletApiOnly() {
        noClasses().that().resideInAPackage("pl.wsb.kasyno.slots..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "pl.wsb.kasyno.wallet.domain..", "pl.wsb.kasyno.wallet.application..", "pl.wsb.kasyno.wallet.web..",
                        "pl.wsb.kasyno.report..")
                .check(classes);
    }

    @Test
    @DisplayName("report tylko czyta przez api innych modułów (bez ich encji i serwisów)")
    void reportUsesApisOnly() {
        noClasses().that().resideInAPackage("pl.wsb.kasyno.report..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "pl.wsb.kasyno.slots.domain..", "pl.wsb.kasyno.slots.application..",
                        "pl.wsb.kasyno.wallet.domain..", "pl.wsb.kasyno.wallet.application..",
                        "pl.wsb.kasyno.account.domain..", "pl.wsb.kasyno.account.application..")
                .check(classes);
    }

    @Test
    @DisplayName("shared nie zależy od żadnego modułu")
    void sharedIsIndependent() {
        noClasses().that().resideInAPackage("pl.wsb.kasyno.shared..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "pl.wsb.kasyno.account..", "pl.wsb.kasyno.wallet..", "pl.wsb.kasyno.slots..", "pl.wsb.kasyno.report..")
                .check(classes);
    }

    @Test
    @DisplayName("warstwa domain nie zależy od application ani web")
    void domainDoesNotDependOnUpperLayers() {
        noClasses().that().resideInAPackage("..domain..")
                .should().dependOnClassesThat().resideInAnyPackage("..application..", "..web..")
                .check(classes);
    }

    @Test
    @DisplayName("kontrolery REST w pakietach web, encje w pakietach domain")
    void conventions() {
        classes().that().areAnnotatedWith(RestController.class).should().resideInAPackage("..web..").check(classes);
        classes().that().areAnnotatedWith(Entity.class).should().resideInAPackage("..domain..").check(classes);
    }

    @Test
    @DisplayName("warstwa application nie zależy od web (serwisy nie znają HTTP)")
    void applicationDoesNotDependOnWeb() {
        noClasses().that().resideInAPackage("..application..")
                .should().dependOnClassesThat().resideInAPackage("..web..")
                .check(classes);
    }

    @Test
    @DisplayName("kontrolery nie używają repozytoriów wprost (tylko serwisów)")
    void webDoesNotUseRepositories() {
        noClasses().that().resideInAPackage("..web..")
                .should().dependOnClassesThat().areAssignableTo(Repository.class)
                .check(classes);
    }

    @Test
    @DisplayName("pakiety api (kontrakty modułów) nie odsłaniają encji ani innych klas z domain")
    void apiDoesNotExposeDomain() {
        noClasses().that().resideInAPackage("..api..")
                .should().dependOnClassesThat().resideInAPackage("..domain..")
                .check(classes);
    }

    /**
     * Encja w odpowiedzi HTTP to wyciek: klient zobaczyłby pola techniczne (np. {@code version}), a Jackson
     * próbowałby czytać relacje LAZY poza transakcją. Reguła sprawdza też typy generyczne, np.
     * {@code List<SpinRound>} albo {@code PageResponse<WalletTransaction>}.
     */
    @Test
    @DisplayName("kontrolery REST nie zwracają encji JPA (także w List<...> i PageResponse<...>), tylko DTO")
    void controllersDoNotReturnEntities() {
        methods().that().areDeclaredInClassesThat().areAnnotatedWith(RestController.class)
                .and().arePublic()
                .should(notReturnEntities())
                .check(classes);
    }

    private static ArchCondition<JavaMethod> notReturnEntities() {
        return new ArchCondition<>("nie zwracać encji JPA") {
            @Override
            public void check(JavaMethod method, ConditionEvents events) {
                method.getReturnType().getAllInvolvedRawTypes().stream()
                        .filter(type -> type.isAnnotatedWith(Entity.class))
                        .forEach(entity -> events.add(SimpleConditionEvent.violated(method,
                                method.getFullName() + " zwraca encję " + entity.getSimpleName())));
            }
        };
    }
}
