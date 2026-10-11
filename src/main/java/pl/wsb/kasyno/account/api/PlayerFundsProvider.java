package pl.wsb.kasyno.account.api;

/**
 * Port: „podaj stan pieniędzy gracza”. Interfejs należy do modułu {@code account}, a implementuje go
 * moduł {@code wallet} ({@code WalletService}).
 *
 * <p>Po co: obiekt {@code player} w API łączy dane konta (nazwa, awatar) z saldem. Gdyby {@code account}
 * wołał {@code wallet} bezpośrednio, a {@code wallet} (przez relację portfel → konto) zależał od {@code account},
 * powstałby cykl. Odwracamy więc zależność (zasada <i>Dependency Inversion</i>, litera D w SOLID):
 * {@code account} definiuje, czego potrzebuje, a Spring wstrzykuje implementację z {@code wallet}.
 */
public interface PlayerFundsProvider {

    PlayerFunds fundsOf(Long playerId);
}
