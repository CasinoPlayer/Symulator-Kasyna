package pl.wsb.kasyno.shared.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Włącza zadania cykliczne ({@code @Scheduled}, LAB 06).
 *
 * <p>Bez {@code @EnableScheduling} adnotacje {@code @Scheduled} na metodach są ignorowane. Włączamy je tutaj,
 * w module wspólnym, a nie na klasie startowej, żeby dało się je wyłączyć jednym wpisem
 * {@code kasyno.schedule.enabled=false}. Robią to testy ({@code application-test.properties}): zadania wywołują
 * wtedy wprost, z zegarem testowym ({@code MutableClock}), bez czekania na godzinę z harmonogramu i bez ryzyka,
 * że zadanie odpali się w połowie innego testu.
 *
 * <p>Zadania w aplikacji (każde w module, który jest właścicielem danych):
 * <ul>
 *   <li>{@code report.application.EconomySnapshotJob}: migawka gospodarki do logu co godzinę
 *       (gracze, bankruci, cebuliony w obiegu, spiny z ostatniej godziny);</li>
 *   <li>{@code slots.application.IdempotencyKeyCleanup}: zapominanie kluczy {@code Idempotency-Key} starszych niż
 *       doba (jak w API płatności: klucz chroni przed podwójnym kliknięciem i ponowieniem, nie na zawsze).</li>
 * </ul>
 *
 * <p>Czego świadomie <b>nie</b> ma, choć plan wymieniał to jako pomysł:
 * <ul>
 *   <li>reset limitu bonusu ratunkowego: limit nie jest licznikiem do zerowania, tylko wynika z daty ostatniego
 *       bonusu ({@code wallet.last_rescue_at} + 10 minut), liczonej przy każdym żądaniu. Jest dokładny co do sekundy
 *       i działa także po restarcie serwera, a zadanie co N minut odblokowywałoby bonus z opóźnieniem do N minut;</li>
 *   <li>sprzątanie sesji: sesje HTTP przechowuje i wygasza serwer Tomcat (po 7 dniach bezczynności,
 *       {@code server.servlet.session.timeout}), więc własne zadanie robiłoby to samo drugi raz.</li>
 * </ul>
 *
 * <p>Wszystkie zadania korzystają z jednego wątku harmonogramu Springa ({@code kasyno-cron-1}); działają krótko
 * (kilka zapytań), więc nie blokują się nawzajem.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(prefix = "kasyno.schedule", name = "enabled", havingValue = "true", matchIfMissing = true)
public class SchedulingConfig {
}
