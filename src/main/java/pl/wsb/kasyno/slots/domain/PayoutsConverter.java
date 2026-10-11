package pl.wsb.kasyno.slots.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Konwerter JPA: kolumna tekstowa {@code "3:5,4:20,5:100"} ↔ obiekt {@link Payouts}.
 */
@Converter
public class PayoutsConverter implements AttributeConverter<Payouts, String> {

    @Override
    public String convertToDatabaseColumn(Payouts payouts) {
        return payouts == null ? null : payouts.toText();
    }

    @Override
    public Payouts convertToEntityAttribute(String column) {
        return Payouts.parse(column);
    }
}
