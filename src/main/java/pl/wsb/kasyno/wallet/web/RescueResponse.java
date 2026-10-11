package pl.wsb.kasyno.wallet.web;

import pl.wsb.kasyno.account.api.PlayerView;

import java.math.BigDecimal;

/**
 * Odpowiedź {@code POST /api/me/rescue}: {@code { "player": {...}, "amount": 10000 }}.
 */
public record RescueResponse(PlayerView player, BigDecimal amount) {
}
