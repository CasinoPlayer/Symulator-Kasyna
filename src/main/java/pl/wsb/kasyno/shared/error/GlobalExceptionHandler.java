package pl.wsb.kasyno.shared.error;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.MethodParameter;
import org.springframework.dao.ConcurrencyFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.lang.Nullable;
import org.springframework.validation.method.ParameterErrors;
import org.springframework.validation.method.ParameterValidationResult;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.util.List;
import java.util.Map;

/**
 * Jedno miejsce, które zamienia wyjątki na odpowiedzi HTTP w formacie {@code application/problem+json}
 * (RFC 9457, klasa {@code ProblemDetail} ze Springa).
 *
 * <p>Po co:
 * <ul>
 *   <li>każda odpowiedź błędu ma ten sam kształt: {@code type}, {@code title}, {@code status}, {@code detail},
 *       {@code instance} oraz nasze pole {@code code} (stały kod z {@link ErrorCode}), czasem {@code errors}
 *       (lista błędnych pól) i {@code retryAfterSeconds};</li>
 *   <li>klient nigdy nie dostaje stack trace ani nazw klas: przy błędzie 5xx szczegóły trafiają tylko do logu
 *       serwera, a w odpowiedzi jest ogólny komunikat;</li>
 *   <li>klasa bazowa {@link ResponseEntityExceptionHandler} obsługuje standardowe błędy Spring MVC
 *       (zły JSON, brak parametru, 404, 405…), a my tylko dopisujemy do nich pole {@code code}.</li>
 * </ul>
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    static final String GENERIC_DETAIL = "Wystąpił nieoczekiwany błąd. Spróbuj ponownie za chwilę.";

    /** Po ilu sekundach klient może ponowić żądanie odrzucone przez {@link ErrorCode#CONCURRENT_REQUEST}. */
    static final long RETRY_AFTER_CONCURRENT_SECONDS = 1;

    /** Jedno błędne pole lub parametr żądania (element listy {@code errors}). */
    public record FieldViolation(String field, String message) {
    }

    /** Wyjątki biznesowe: kod i status bierzemy z wyjątku. */
    @ExceptionHandler(CasinoException.class)
    public ResponseEntity<Object> handleCasino(CasinoException ex) {
        ErrorCode code = ex.getCode();
        String detail = ex.getMessage();
        if (code == ErrorCode.INTERNAL_ERROR) {
            // błąd w kodzie (np. niedozwolone przejście statusu rundy): pełny wyjątek tylko w logu
            log.error("Błąd serwera", ex);
            detail = GENERIC_DETAIL;
        } else if (code.status().is5xxServerError()) {
            // przewidziana niedostępność (np. gra bez silnika): wystarczy krótka informacja w logu
            log.warn("{}: {}", code, ex.getMessage());
        }
        ProblemDetail problem = problem(code, detail);
        HttpHeaders headers = new HttpHeaders();
        if (ex.getRetryAfterSeconds() != null) {
            problem.setProperty("retryAfterSeconds", ex.getRetryAfterSeconds());
            headers.set(HttpHeaders.RETRY_AFTER, String.valueOf(ex.getRetryAfterSeconds()));
        }
        return ResponseEntity.status(code.status()).headers(headers).body(problem);
    }

    /**
     * Równoległe żądania tego samego gracza: baza nie doczekała się blokady portfela (np. kilka spinów naraz)
     * albo blokada optymistyczna ({@code @Version}) wykryła zmianę w międzyczasie. Transakcja jest wycofana,
     * więc dane są spójne, a klient może po prostu ponowić żądanie. To nie jest błąd w kodzie, więc zamiast
     * {@code 500} ze stack trace w logu dajemy {@code 409 CONCURRENT_REQUEST} z {@code Retry-After}.
     */
    @ExceptionHandler(ConcurrencyFailureException.class)
    public ResponseEntity<Object> handleConcurrency(ConcurrencyFailureException ex) {
        log.warn("Równoległe żądanie odrzucone: {}", ex.getClass().getSimpleName());
        ProblemDetail problem = problem(ErrorCode.CONCURRENT_REQUEST,
                "Poprzednie żądanie jeszcze trwa. Spróbuj ponownie za chwilę.");
        problem.setProperty("retryAfterSeconds", RETRY_AFTER_CONCURRENT_SECONDS);
        return ResponseEntity.status(ErrorCode.CONCURRENT_REQUEST.status())
                .header(HttpHeaders.RETRY_AFTER, String.valueOf(RETRY_AFTER_CONCURRENT_SECONDS))
                .body(problem);
    }

    /** Wszystko, czego się nie spodziewaliśmy: 500 bez szczegółów technicznych, pełny wyjątek w logu. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> handleUnexpected(Exception ex) {
        log.error("Nieoczekiwany błąd", ex);
        return ResponseEntity.internalServerError().body(problem(ErrorCode.INTERNAL_ERROR, GENERIC_DETAIL));
    }

    /** Błędy Bean Validation w ciele żądania ({@code @Valid @RequestBody}). */
    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex, HttpHeaders headers,
                                                                  HttpStatusCode status, WebRequest request) {
        List<FieldViolation> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> new FieldViolation(error.getField(), error.getDefaultMessage()))
                .toList();
        return validationFailed(errors);
    }

    /** Błędy Bean Validation parametrów metody ({@code @RequestParam @Max(100) int size} itp.). */
    @Override
    protected ResponseEntity<Object> handleHandlerMethodValidationException(HandlerMethodValidationException ex,
                                                                            HttpHeaders headers, HttpStatusCode status,
                                                                            WebRequest request) {
        List<FieldViolation> errors = ex.getParameterValidationResults().stream()
                .flatMap(result -> result instanceof ParameterErrors bodyErrors
                        // obiekt z ciała żądania: podajemy nazwy jego pól (np. "bet"), a nie nazwę parametru metody
                        ? bodyErrors.getFieldErrors().stream()
                                .map(error -> new FieldViolation(error.getField(), error.getDefaultMessage()))
                        : result.getResolvableErrors().stream()
                                .map(error -> new FieldViolation(parameterName(result), error.getDefaultMessage())))
                .toList();
        return validationFailed(errors);
    }

    /**
     * Pozostałe błędy Spring MVC (zły JSON, zły typ parametru, nieznany adres, zła metoda…): klasa bazowa
     * buduje już ProblemDetail, a my dopisujemy kod, polski tytuł i polski opis. Dla 5xx podmieniamy treść na ogólną.
     */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception ex, @Nullable Object body, HttpHeaders headers,
                                                             HttpStatusCode statusCode, WebRequest request) {
        // klasa bazowa często przekazuje body = null i dopiero tutaj bierze ProblemDetail z wyjątku,
        // dlatego uzupełniamy odpowiedź już zbudowaną przez super
        ResponseEntity<Object> response = super.handleExceptionInternal(ex, body, headers, statusCode, request);
        if (response != null && response.getBody() instanceof ProblemDetail problem && !hasCode(problem)) {
            ErrorCode code = codeFor(statusCode);
            problem.setProperty("code", code.name());
            problem.setTitle(code.title());
            problem.setType(code.type());
            if (statusCode.is5xxServerError()) {
                log.error("Błąd serwera w warstwie web", ex);
                problem.setDetail(GENERIC_DETAIL);
            } else {
                problem.setDetail(polishDetail(ex, statusCode, problem.getDetail()));
            }
        }
        return response;
    }

    /**
     * Polski opis typowych błędów Spring MVC. Klasa bazowa daje angielskie teksty („Failed to read request”),
     * a reszta API odpowiada po polsku; front może pokazać {@code detail} graczowi bez tłumaczenia.
     * Nazwy parametrów pochodzą z naszego kodu (adnotacje kontrolerów), nie z danych od klienta.
     */
    private static String polishDetail(Exception ex, HttpStatusCode status, String fallback) {
        if (ex instanceof HttpMessageNotReadableException) {
            return "Treść żądania nie jest poprawnym JSON-em albo któreś pole ma zły typ.";
        }
        if (ex instanceof MethodArgumentTypeMismatchException mismatch) {
            return "Parametr „%s” ma niepoprawny format.".formatted(mismatch.getName());
        }
        if (ex instanceof MissingServletRequestParameterException missing) {
            return "Brakuje parametru „%s”.".formatted(missing.getParameterName());
        }
        if (ex instanceof HttpMediaTypeNotSupportedException) {
            return "Dane wysyłaj jako JSON (nagłówek Content-Type: application/json).";
        }
        return switch (status.value()) {
            case 404 -> "Nie ma takiego adresu.";
            case 405 -> "Ta metoda HTTP nie jest obsługiwana pod tym adresem.";
            default -> fallback;
        };
    }

    private ResponseEntity<Object> validationFailed(List<FieldViolation> errors) {
        ProblemDetail problem = problem(ErrorCode.VALIDATION_FAILED, "Popraw zaznaczone pola i spróbuj ponownie.");
        problem.setProperty("errors", errors);
        return ResponseEntity.badRequest().body(problem);
    }

    private static ProblemDetail problem(ErrorCode code, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(code.status(), detail);
        problem.setTitle(code.title());
        problem.setType(code.type());
        problem.setProperty("code", code.name());
        return problem;
    }

    private static boolean hasCode(ProblemDetail problem) {
        Map<String, Object> properties = problem.getProperties();
        return properties != null && properties.containsKey("code");
    }

    private static ErrorCode codeFor(HttpStatusCode status) {
        if (status.is5xxServerError()) {
            return ErrorCode.INTERNAL_ERROR;
        }
        if (status.value() == HttpStatus.NOT_FOUND.value()) {
            return ErrorCode.NOT_FOUND;
        }
        if (status.value() == HttpStatus.METHOD_NOT_ALLOWED.value()) {
            return ErrorCode.METHOD_NOT_ALLOWED;
        }
        if (status.value() == HttpStatus.UNAUTHORIZED.value()) {
            return ErrorCode.NOT_LOGGED_IN;
        }
        return ErrorCode.VALIDATION_FAILED;
    }

    /** Nazwa parametru tak, jak widzi ją klient (np. {@code Idempotency-Key}, a nie nazwa zmiennej w Javie). */
    private static String parameterName(ParameterValidationResult result) {
        MethodParameter parameter = result.getMethodParameter();
        RequestParam requestParam = parameter.getParameterAnnotation(RequestParam.class);
        if (requestParam != null) {
            return firstNonBlank(requestParam.name(), requestParam.value(), parameter.getParameterName());
        }
        RequestHeader requestHeader = parameter.getParameterAnnotation(RequestHeader.class);
        if (requestHeader != null) {
            return firstNonBlank(requestHeader.name(), requestHeader.value(), parameter.getParameterName());
        }
        return parameter.getParameterName();
    }

    private static String firstNonBlank(String... candidates) {
        for (String candidate : candidates) {
            if (candidate != null && !candidate.isBlank()) {
                return candidate;
            }
        }
        return "?";
    }
}
