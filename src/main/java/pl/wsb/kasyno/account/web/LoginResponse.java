package pl.wsb.kasyno.account.web;

import pl.wsb.kasyno.account.api.PlayerView;

import java.math.BigDecimal;

/**
 * Odpowiedź logowania: {@code { "player": {...}, "newPlayer": true, "welcomeBonus": 10000 }}.
 * Front na podstawie {@code newPlayer} odpala sekwencję bonusu powitalnego (skrzynia, fontanna monet).
 */
public record LoginResponse(PlayerView player, boolean newPlayer, BigDecimal welcomeBonus) {
}
