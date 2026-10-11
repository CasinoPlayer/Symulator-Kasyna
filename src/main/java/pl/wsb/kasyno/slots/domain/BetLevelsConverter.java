package pl.wsb.kasyno.slots.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Konwerter JPA: kolumna tekstowa {@code "10,20,50"} ↔ obiekt {@link BetLevels}. Hibernate woła go przy każdym
 * zapisie i odczycie pola oznaczonego {@code @Convert(converter = BetLevelsConverter.class)}.
 */
@Converter
public class BetLevelsConverter implements AttributeConverter<BetLevels, String> {

    @Override
    public String convertToDatabaseColumn(BetLevels levels) {
        return levels == null ? null : levels.toCsv();
    }

    @Override
    public BetLevels convertToEntityAttribute(String column) {
        return column == null ? null : BetLevels.parse(column);
    }
}
