package pl.wsb.kasyno.account.api;

/**
 * Fasada modułu {@code account}: składa obiekt {@link PlayerView} dla danego gracza.
 * Korzysta z niej np. moduł {@code wallet} po odebraniu bonusu ratunkowego.
 */
public interface PlayerProfiles {

    /**
     * @throws pl.wsb.kasyno.shared.error.NotLoggedInException gdy gracza nie ma (np. nieaktualna sesja)
     */
    PlayerView view(Long playerId);
}
