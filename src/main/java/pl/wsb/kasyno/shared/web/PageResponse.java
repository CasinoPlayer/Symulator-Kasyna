package pl.wsb.kasyno.shared.web;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/**
 * Strona wyników w formacie z kontraktu API:
 * {@code { "items": [...], "page": 0, "size": 20, "totalItems": 57, "totalPages": 3 }}.
 *
 * <p>Po co własny rekord zamiast zwracać {@code Page} ze Spring Data: JSON obiektu {@code Page} zawiera wiele
 * pól technicznych i może się zmieniać między wersjami Springa. Własny kształt jest stabilny i opisany w kontrakcie.
 *
 * @param <T> typ elementu (DTO)
 */
public record PageResponse<T>(List<T> items, int page, int size, long totalItems, int totalPages) {

    /** Zamienia stronę encji na stronę DTO, mapując każdy element funkcją {@code mapper}. */
    public static <E, T> PageResponse<T> from(Page<E> page, Function<E, T> mapper) {
        return new PageResponse<>(
                page.getContent().stream().map(mapper).toList(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages());
    }
}
