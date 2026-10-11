package pl.wsb.kasyno.report.web;

import pl.wsb.kasyno.account.api.PlayerAvatar;
import pl.wsb.kasyno.slots.api.BigWin;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Wpis feedu dużych wygranych:
 * {@code { "nick", "avatarIndex", "gameCode", "gameName", "win", "multiplier", "tier", "at" }}.
 */
public record BigWinResponse(String nick, int avatarIndex, String gameCode, String gameName, BigDecimal win,
                             BigDecimal multiplier, String tier, Instant at) {

    public static BigWinResponse from(BigWin win) {
        return new BigWinResponse(win.nick(), PlayerAvatar.indexFor(win.nick()), win.gameCode(), win.gameName(),
                win.win(), win.multiplier(), win.tier(), win.at());
    }
}
