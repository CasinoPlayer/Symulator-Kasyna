package pl.wsb.kasyno;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import jakarta.persistence.Entity;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.RestController;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
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
}
