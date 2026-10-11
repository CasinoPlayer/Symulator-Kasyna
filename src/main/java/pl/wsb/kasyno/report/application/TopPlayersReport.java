package pl.wsb.kasyno.report.application;

import pl.wsb.kasyno.slots.api.PlayerResult;

import java.util.List;

/**
 * Pytanie inwestora 3: „Kto prowadzi w rankingu?” w dwóch ujęciach.
 *
 * @param byNetResult  najlepszy bilans (wygrane − zakłady)
 * @param byBiggestWin największa pojedyncza wygrana
 */
public record TopPlayersReport(List<PlayerResult> byNetResult, List<PlayerResult> byBiggestWin) {
}
