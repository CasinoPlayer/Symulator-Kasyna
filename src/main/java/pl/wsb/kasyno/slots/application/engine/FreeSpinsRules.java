package pl.wsb.kasyno.slots.application.engine;

/**
 * Zasady darmowych spinów gry (Złoty Faraon, Kryształowa Kaskada).
 *
 * <p>Darmowe spiny są częścią tej samej rundy co spin, który je uruchomił: gracz płaci zakład raz, a serwer od razu
 * rozgrywa wszystkie darmowe spiny i zwraca je jako kolejne kroki. Limit {@code maxTotal} zamyka „nieskończony”
 * łańcuch dodatkowych spinów i ogranicza najdłuższą możliwą odpowiedź.
 *
 * @param triggerCount     ile scatterów w grze podstawowej uruchamia darmowe spiny (S2: 3, S3: 4)
 * @param awarded          ile darmowych spinów na start (10)
 * @param retriggerCount   ile scatterów w darmowym spinie dodaje spiny (3)
 * @param retriggerAwarded ile spinów dodaje (S2: 10, S3: 5)
 * @param maxTotal         ile darmowych spinów łącznie najwyżej w jednej rundzie (50)
 */
public record FreeSpinsRules(int triggerCount, int awarded, int retriggerCount, int retriggerAwarded, int maxTotal) {

    public FreeSpinsRules {
        if (triggerCount <= 0 || awarded <= 0 || retriggerCount <= 0 || retriggerAwarded < 0 || maxTotal < awarded) {
            throw new IllegalArgumentException("Niepoprawne zasady darmowych spinów");
        }
    }
}
