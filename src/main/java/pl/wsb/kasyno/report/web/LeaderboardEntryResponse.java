package pl.wsb.kasyno.report.web;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Pozycja rankingu: {@code { "rank", "nick", "avatarIndex", "value", "gameCode", "at" }} (kontrakt § 2.3).
 */
public record LeaderboardEntryResponse(int rank, String nick, int avatarIndex, BigDecimal value, String gameCode,
                                       Instant at) {
}
