package pl.wsb.kasyno.slots.application.engine;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;

import java.util.List;

/**
 * Zamiana kroków rundy na JSON {@code {"steps":[...]}} (część odpowiedzi spinu z kontraktu § 2.4; resztę pól,
 * np. saldo, dokleja {@code SpinService}).
 *
 * <p>Własny, prywatny {@link ObjectMapper} zamiast beana ze Springa: silnik ma działać tak samo w aplikacji
 * i w zwykłym teście JUnit (bez kontekstu Springa), a format kroków nie może zależeć od globalnych ustawień
 * Jacksona. {@code ObjectMapper} po skonfigurowaniu jest bezpieczny wątkowo, więc wystarczy jeden egzemplarz.
 */
public final class RoundJson {

    private static final ObjectMapper MAPPER = JsonMapper.builder()
            .serializationInclusion(JsonInclude.Include.NON_NULL)
            .build();

    private RoundJson() {
    }

    /** Dokument {@code {"steps":[...]}} dla listy kroków. */
    public static String stepsDocument(List<RoundStep> steps) {
        try {
            return MAPPER.writeValueAsString(new StepsDocument(steps));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Nie udało się zapisać kroków rundy jako JSON", e);
        }
    }

    /** Opakowanie listy: zadeklarowany typ elementu {@code RoundStep} włącza pole {@code "type"} w każdym kroku. */
    private record StepsDocument(List<RoundStep> steps) {
    }
}
