package pl.wsb.kasyno.report.web;

import pl.wsb.kasyno.slots.api.GameRtp;

import java.math.BigDecimal;

/**
 * Pytanie inwestora 2: {@code { "gameCode", "targetRtp", "actualRtp", "spins", "totalWagered", "totalWon" }}.
 * {@code actualRtp} jest {@code null}, gdy w grę nikt jeszcze nie grał.
 */
public record RtpResponse(String gameCode, BigDecimal targetRtp, BigDecimal actualRtp, long spins,
                          BigDecimal totalWagered, BigDecimal totalWon) {

    public static RtpResponse from(GameRtp rtp) {
        return new RtpResponse(rtp.gameCode(), rtp.targetRtp(), rtp.actualRtp(), rtp.spins(), rtp.totalWagered(),
                rtp.totalWon());
    }
}
