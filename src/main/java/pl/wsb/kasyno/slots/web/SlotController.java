package pl.wsb.kasyno.slots.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.wsb.kasyno.shared.web.CurrentPlayer;
import pl.wsb.kasyno.slots.application.SlotCatalogService;
import pl.wsb.kasyno.slots.application.SpinCommand;
import pl.wsb.kasyno.slots.application.SpinResult;
import pl.wsb.kasyno.slots.application.SpinService;

import java.util.List;

/**
 * Katalog automatów i spin ({@code /api/slots}, kontrakt § 2.2).
 */
@Tag(name = "Automaty")
@RestController
@RequestMapping("/api/slots")
public class SlotController {

    private final SlotCatalogService catalog;
    private final SpinService spinService;

    public SlotController(SlotCatalogService catalog, SpinService spinService) {
        this.catalog = catalog;
        this.spinService = spinService;
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
            description = "Wynik liczy serwer. Ten sam Idempotency-Key zwraca tę samą rundę zamiast losować nową.")
    @PostMapping("/{code}/spins")
    public SpinResponse spin(
            @CurrentPlayer Long playerId,
            @PathVariable("code") String code,
            @Valid @RequestBody SpinRequest request,
            @Parameter(description = "Losowy identyfikator żądania (np. UUID); chroni przed podwójnym kliknięciem")
            @RequestHeader(name = "Idempotency-Key", required = false)
            @Size(max = 64, message = "Idempotency-Key może mieć najwyżej 64 znaki") String idempotencyKey) {
        String key = idempotencyKey == null || idempotencyKey.isBlank() ? null : idempotencyKey.strip();
        // równoczesne żądania z tym samym kluczem szereguje SpinService (blokada portfela), więc nie ponawiamy tu
        // niczego: drugie żądanie po prostu dostaje powtórkę rundy zapisanej przez pierwsze
        SpinResult result = spinService.spin(new SpinCommand(playerId, code, request.bet(), key));
        return SpinResponse.from(result);
    }
}
