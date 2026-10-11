package pl.wsb.kasyno.report.application;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.wsb.kasyno.slots.api.GamePopularity;
import pl.wsb.kasyno.slots.api.GameRtp;
import pl.wsb.kasyno.slots.api.HourlyActivity;
import pl.wsb.kasyno.slots.api.SlotsFacade;
import pl.wsb.kasyno.wallet.api.WalletEconomy;
import pl.wsb.kasyno.wallet.api.WalletFacade;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Pięć „pytań inwestora” (plan projektu § 5.5, LAB 03), na które baza danych musi umieć odpowiedzieć:
 * <ol>
 *   <li>Które automaty są najpopularniejsze (liczba spinów) w ostatnich 7 dniach?</li>
 *   <li>Jaki jest rzeczywisty RTP każdego automatu w porównaniu z docelowym?</li>
 *   <li>Kto prowadzi w rankingu (największa pojedyncza wygrana, najlepszy bilans)?</li>
 *   <li>Ilu graczy jest „na zero” i ile cebulionów jest w obiegu?</li>
 *   <li>O jakich godzinach gra się najwięcej i jaki jest średni zakład?</li>
 * </ol>
 * Same zapytania (JPQL z {@code GROUP BY}) są w repozytoriach modułów, które są właścicielami danych;
 * ten serwis tylko je zbiera przez fasady.
 *
 * <p>{@code @Transactional(readOnly = true)}: raport złożony z kilku zapytań (np. pytanie 3 i 4) wykonuje się
 * w jednej transakcji i na jednym połączeniu z bazy, a transakcje fasad do niej dołączają.
 */
@Service
@Transactional(readOnly = true)
public class InvestorReportService {

    private final SlotsFacade slots;
    private final WalletFacade wallet;
    private final Clock clock;

    public InvestorReportService(SlotsFacade slots, WalletFacade wallet, Clock clock) {
        this.slots = slots;
        this.wallet = wallet;
        this.clock = clock;
    }

    /** Pytanie 1. */
    public List<GamePopularity> popularGames(int days) {
        Instant since = clock.instant().minus(Duration.ofDays(days));
        return slots.popularGames(since);
    }

    /** Pytanie 2. */
    public List<GameRtp> rtp() {
        return slots.rtpByGame();
    }

    /** Pytanie 3. */
    public TopPlayersReport topPlayers(int limit) {
        return new TopPlayersReport(slots.topPlayersByNetResult(limit), slots.topPlayersByBiggestWin(limit));
    }

    /** Pytanie 4. „Na zero” = saldo poniżej najmniejszego zakładu w kasynie. */
    public WalletEconomy economy() {
        return wallet.economy(slots.minimumBet());
    }

    /** Pytanie 5. */
    public List<HourlyActivity> peakHours() {
        return slots.peakHours();
    }
}
