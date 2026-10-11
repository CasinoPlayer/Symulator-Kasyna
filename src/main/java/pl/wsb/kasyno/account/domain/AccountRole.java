package pl.wsb.kasyno.account.domain;

/**
 * Rola konta (z szablonu kursu). Gracze kasyna logujący się nazwą dostają rolę {@link #USER}.
 */
public enum AccountRole {
    USER,
    PARTNER,
    ADMIN
}
