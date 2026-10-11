package pl.wsb.kasyno.report.web;

import pl.wsb.kasyno.slots.api.HourlyActivity;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Pytanie inwestora 5: {@code { "hour", "spins", "averageBet" }}; godzina w UTC (0–23),
 * średni zakład zaokrąglony do 2 miejsc po przecinku.
 */
public record PeakHourResponse(int hour, long spins, BigDecimal averageBet) {

    public static PeakHourResponse from(HourlyActivity activity) {
        BigDecimal average = activity.averageBet() == null
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(activity.averageBet()).setScale(2, RoundingMode.HALF_UP);
        return new PeakHourResponse(activity.hour(), activity.spins(), average);
    }
}
