package pl.wsb.kasyno.slots.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Konwerter JPA: kolumna tekstowa {@code "a,b,c|d,e,f"} ↔ obiekt {@link ReelStrips}. Pusta kolumna oznacza
 * brak taśm (gra klastrowa albo brak osobnych taśm darmowych spinów).
 */
@Converter
public class ReelStripsConverter implements AttributeConverter<ReelStrips, String> {

    @Override
    public String convertToDatabaseColumn(ReelStrips strips) {
        return strips == null ? null : strips.toText();
    }

    @Override
    public ReelStrips convertToEntityAttribute(String column) {
        return column == null || column.isBlank() ? null : ReelStrips.parse(column);
    }
}
