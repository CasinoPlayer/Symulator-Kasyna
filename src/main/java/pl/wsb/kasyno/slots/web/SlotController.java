package pl.wsb.kasyno.slots.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.wsb.kasyno.shared.config.CasinoProperties;
import pl.wsb.kasyno.shared.error.CasinoException;
import pl.wsb.kasyno.shared.error.ErrorCode;
import pl.wsb.kasyno.shared.web.CurrentPlayer;
import pl.wsb.kasyno.slots.application.SlotCatalogService;
import pl.wsb.kasyno.slots.application.SpinCommand;
import pl.wsb.kasyno.slots.application.SpinResult;
import pl.wsb.kasyno.slots.application.SpinService;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Katalog automatów i spin ({@code /api/slots}, kontrakt § 2.2).
 *
 * <p>Nagłówek {@code X-Demo-Seed} (profil {@code demo}, nagrywanie filmików): gdy {@code kasyno.demo.allow-seed=true},
 * ziarno rundy jest takie, jak w nagłówku, zamiast losowego. W każdym innym profilu nagłówek jest <b>ignorowany</b>
 * (nawet nie sprawdzamy jego formatu), bo inaczej gracz mógłby podać ziarno znanej sobie wygrywającej rundy.
 * Decyzja zapada tutaj, na granicy aplikacji: to jedyne miejsce, przez które ziarno może przyjść z zewnątrz.
 */
@Tag(name = "Automaty")
@RestController
@RequestMapping("/api/slots")
public class SlotController {

    /** Nagłówek odpowiedzi na powtórzone żądanie (ten sam {@code Idempotency-Key}): runda nie była losowana od nowa. */
    public static final String REPLAYED_HEADER = "Idempotent-Replayed";

    /** Nagłówek z ziarnem rundy, honorowany tylko w profilu {@code demo} ({@code kasyno.demo.allow-seed=true}). */
    public static final String DEMO_SEED_HEADER = "X-Demo-Seed";

    /** Ziarno jak w polu {@code seed} odpowiedzi: 1–16 cyfr szesnastkowych, opcjonalnie z przedrostkiem {@code 0x}. */
    private static final Pattern HEX_SEED = Pattern.compile("(0x)?[0-9a-f]{1,16}");

    private final SlotCatalogService catalog;
    private final SpinService spinService;
    private final CasinoProperties properties;

    public SlotController(SlotCatalogService catalog, SpinService spinService, CasinoProperties properties) {
        this.catalog = catalog;
        this.spinService = spinService;
        this.properties = properties;
    }

    @Operation(summary = "Lista gier")
    @GetMapping
    public List<SlotSummaryResponse> list() {
        return catalog.activeMachines().stream().map(SlotSummaryResponse::from).toList();
    }

    @Operation(summary = "Szczegóły gry z tabelą wypłat i opisem funkcji")
    @GetMapping("/{code}")
    public SlotDetailsResponse details(@PathVariable("code") String code) {
        return SlotDetailsResponse.from(catalog.machineWithSymbols(code));
    }

    @Operation(summary = "Spin (jedna runda = jeden zakład)",
            description = "Wynik liczy serwer i zwraca całą rundę jako listę kroków animacji (kontrakt § 2.4). "
                    + "Ten sam Idempotency-Key zwraca tę samą rundę (tę samą odpowiedź) zamiast losować nową; "
                    + "taka powtórka ma nagłówek " + REPLAYED_HEADER + ": true.")
    @ApiResponse(responseCode = "200", description = "Przebieg rundy",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                    schema = @Schema(implementation = SpinResponse.class)))
    @PostMapping("/{code}/spins")
    public ResponseEntity<String> spin(
            @CurrentPlayer Long playerId,
            @PathVariable("code") String code,
            @Valid @RequestBody SpinRequest request,
            @Parameter(description = "Losowy identyfikator żądania (np. UUID); chroni przed podwójnym kliknięciem")
            @RequestHeader(name = "Idempotency-Key", required = false)
            @Size(max = 64, message = "Idempotency-Key może mieć najwyżej 64 znaki") String idempotencyKey,
            @Parameter(description = "Tylko profil demo (kasyno.demo.allow-seed=true): ziarno rundy szesnastkowo, "
                    + "np. 5f3a9c0e7b21d4a8. W pozostałych profilach nagłówek jest ignorowany.")
            @RequestHeader(name = DEMO_SEED_HEADER, required = false) String demoSeedHeader) {
        String key = idempotencyKey == null || idempotencyKey.isBlank() ? null : idempotencyKey.strip();
        Long demoSeed = properties.demo().allowSeed() ? parseDemoSeed(demoSeedHeader) : null;
        // równoczesne żądania z tym samym kluczem szereguje SpinService (blokada portfela), więc nie ponawiamy tu
        // niczego: drugie żądanie po prostu dostaje powtórkę rundy zapisanej przez pierwsze
        SpinResult result = spinService.spin(new SpinCommand(playerId, code, request.bet(), key, demoSeed));
        // treść = dokument rundy zapisany w spin_round.result_json (SpinDocument), wysłany bez przepisywania pól
        ResponseEntity.BodyBuilder response = ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON);
        if (result.replayed()) {
            response.header(REPLAYED_HEADER, "true");
        }
        return response.body(result.resultJson());
    }

    /**
     * Ziarno z nagłówka {@code X-Demo-Seed} w tym samym zapisie, w jakim API je zwraca (pole {@code seed}), więc
     * rundę z nagrania można odtworzyć, wklejając jej {@code seed}. Brak nagłówka = ziarno losowe.
     *
     * @throws CasinoException {@code 400 VALIDATION_FAILED}, gdy nagłówek nie jest liczbą szesnastkową
     */
    static Long parseDemoSeed(String header) {
        if (header == null || header.isBlank()) {
            return null;
        }
        String value = header.strip().toLowerCase(Locale.ROOT);
        if (!HEX_SEED.matcher(value).matches()) {
            throw new CasinoException(ErrorCode.VALIDATION_FAILED,
                    DEMO_SEED_HEADER + " musi być liczbą szesnastkową (1–16 cyfr), np. 5f3a9c0e7b21d4a8.");
        }
        // parseUnsignedLong: „ffffffffffffffff” to −1 w typie long, tak samo jak w polu seed odpowiedzi
        return Long.parseUnsignedLong(value.startsWith("0x") ? value.substring(2) : value, 16);
    }
}
