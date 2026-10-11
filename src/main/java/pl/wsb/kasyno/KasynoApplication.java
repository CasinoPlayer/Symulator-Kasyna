package pl.wsb.kasyno;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Punkt startowy aplikacji Cebulion Casino (symulator kasyna z wirtualną walutą „cebulion”).
 *
 * <p>{@code @SpringBootApplication} włącza konfigurację automatyczną i skanowanie komponentów
 * w pakiecie {@code pl.wsb.kasyno} i jego podpakietach (moduły: {@code account}, a od kolejnych
 * laboratoriów {@code wallet}, {@code slots}, {@code report}). Reguła R1.01 sprawdza, że to jedyna
 * klasa startowa i że leży w pakiecie {@code pl.wsb.<nazwaprojektu>}.
 */
@SpringBootApplication
public class KasynoApplication {

    public static void main(String[] args) {
        SpringApplication.run(KasynoApplication.class, args);
    }
}
