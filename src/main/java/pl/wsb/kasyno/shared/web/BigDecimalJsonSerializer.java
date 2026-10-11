package pl.wsb.kasyno.shared.web;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import org.springframework.boot.jackson.JsonComponent;

import java.io.IOException;
import java.math.BigDecimal;

/**
 * Zapis liczb {@link BigDecimal} do JSON bez zbędnych zer po przecinku.
 *
 * <p>Po co: kwoty trzymamy w bazie jako {@code DECIMAL(19,2)} (wymóg kursu: {@code BigDecimal} dla kwot), więc
 * saldo w Javie to {@code 10000.00}. Kontrakt API mówi, że kwoty w JSON to liczby całkowite ({@code 10000}).
 * Ten serializer zapisuje {@code 10000.00} jako {@code 10000}, {@code 95.50} jako {@code 95.5}, a {@code 0.00}
 * jako {@code 0}. Zawsze w zapisie dziesiętnym (nigdy {@code 1E+4}). {@code @JsonComponent} rejestruje go
 * automatycznie w Jacksonie używanym przez Spring MVC.
 */
@JsonComponent
public class BigDecimalJsonSerializer extends JsonSerializer<BigDecimal> {

    @Override
    public void serialize(BigDecimal value, JsonGenerator generator, SerializerProvider serializers) throws IOException {
        generator.writeNumber(value.stripTrailingZeros().toPlainString());
    }

    @Override
    public Class<BigDecimal> handledType() {
        return BigDecimal.class;
    }
}
