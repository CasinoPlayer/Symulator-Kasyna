package pl.wsb.kasyno;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * Punkt startowy aplikacji Cebulion Casino (symulator kasyna z wirtualną walutą „cebulion”).
 *
 * <p>{@code @SpringBootApplication} włącza konfigurację automatyczną i skanowanie komponentów
 * w pakiecie {@code pl.wsb.kasyno} i jego podpakietach (moduły: {@code account}, {@code wallet},
 * {@code slots}, {@code report} oraz wspólny {@code shared}). Reguła R1.01 sprawdza, że to jedyna
 * klasa startowa i że leży w pakiecie {@code pl.wsb.<nazwaprojektu>}.
 *
 * <p>{@code @ConfigurationPropertiesScan} wyszukuje rekordy z {@code @ConfigurationProperties}
 * (u nas {@link pl.wsb.kasyno.shared.config.CasinoProperties}) i wiąże je z wpisami
 * {@code kasyno.*} z {@code application.properties}.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class KasynoApplication {

    public static void main(String[] args) {
        SpringApplication.run(KasynoApplication.class, args);
    }
}
