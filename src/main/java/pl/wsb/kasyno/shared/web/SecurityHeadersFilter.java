package pl.wsb.kasyno.shared.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Dopisuje do każdej odpowiedzi (API i plików statycznych) trzy nagłówki bezpieczeństwa przeglądarki.
 *
 * <ul>
 *   <li>{@code X-Content-Type-Options: nosniff}: przeglądarka nie „zgaduje” typu pliku. Plik tekstowy nie
 *       wykona się jako skrypt tylko dlatego, że wygląda jak JavaScript;</li>
 *   <li>{@code X-Frame-Options: SAMEORIGIN}: obca strona nie osadzi kasyna w niewidocznej ramce i nie podsunie
 *       graczowi kliknięcia w „SPIN” (atak <i>clickjacking</i>). Ramki z tej samej domeny są dozwolone (korzysta
 *       z nich konsola H2);</li>
 *   <li>{@code Referrer-Policy: same-origin}: adres strony nie wycieka do obcych serwisów w nagłówku
 *       {@code Referer}.</li>
 * </ul>
 *
 * <p>Po co filtr, a nie Spring Security: aplikacja nie ma haseł ani ról (logowanie samą nazwą gracza), więc cały
 * Spring Security byłby tu tylko po to, żeby dodać te nagłówki. {@link OncePerRequestFilter} gwarantuje, że
 * nagłówki dopiszą się raz na żądanie, także przy wewnętrznym przekierowaniu na stronę błędu.
 * Świadomie nie ustawiamy tu {@code Content-Security-Policy}: jej treść zależy od tego, jak front ładuje skrypty
 * i style, więc musi powstać razem z frontem.
 */
@Component
public class SecurityHeadersFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "SAMEORIGIN");
        response.setHeader("Referrer-Policy", "same-origin");
        chain.doFilter(request, response);
    }
}
