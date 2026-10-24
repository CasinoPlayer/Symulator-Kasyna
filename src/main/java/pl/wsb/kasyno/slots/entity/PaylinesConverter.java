package pl.wsb.kasyno.slots.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Konwerter JPA: kolumna tekstowa {@code "1,1,1|0,0,0"} ↔ obiekt {@link Paylines}. Pusta kolumna oznacza grę
 * bez linii (klastrową).
 */
@Converter
public class PaylinesConverter implements AttributeConverter<Paylines, String> {

    @Override
    public String convertToDatabaseColumn(Paylines paylines) {
        return paylines == null ? null : paylines.toText();
    }

    @Override
    public Paylines convertToEntityAttribute(String column) {
        return column == null || column.isBlank() ? null : Paylines.parse(column);
    }
}
