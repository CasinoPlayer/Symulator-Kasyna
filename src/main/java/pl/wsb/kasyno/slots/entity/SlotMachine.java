package pl.wsb.kasyno.slots.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Automat do gry (tabela {@code slot_machine}): konfiguracja jednej z trzech gier.
 *
 * <p>Kod gry ({@code cebulowy-777}, {@code zloty-faraon}, {@code krysztalowa-kaskada}) jest unikalny i występuje
 * w adresach API, np. {@code POST /api/slots/zloty-faraon/spins}. Rozmiar planszy (bębny, rzędy, linie) to klasa
 * wbudowana {@link ReelGrid}: jej pola są kolumnami tej samej tabeli.
 */
@Entity
@Table(name = "slot_machine")
public class SlotMachine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", nullable = false, unique = true, length = 40)
    private String code;

    @Column(name = "name", nullable = false, length = 60)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "engine_type", nullable = false, length = 20)
    private EngineType engineType;

    /** Plansza: bębny, rzędy i linie (kolumny {@code reel_count}, {@code row_count}, {@code line_count}). */
    @Embedded
    private ReelGrid grid;

    /** Dozwolone zakłady; kolumna tekstowa z konwerterem (uzasadnienie w {@link BetLevels}). */
    @Convert(converter = BetLevelsConverter.class)
    @Column(name = "bet_levels", nullable = false, length = 200)
    private BetLevels betLevels;

    @Column(name = "min_bet", nullable = false, precision = 19, scale = 2)
    private BigDecimal minBet;

    @Column(name = "max_bet", nullable = false, precision = 19, scale = 2)
    private BigDecimal maxBet;

    /** Docelowy RTP w procentach, np. {@code 95.00} (jaka część zakładów wraca średnio do graczy). */
    @Column(name = "target_rtp", nullable = false, precision = 5, scale = 2)
    private BigDecimal targetRtp;

    @Enumerated(EnumType.STRING)
    @Column(name = "volatility", nullable = false, length = 20)
    private Volatility volatility;

    /** Opis funkcji gry do ekranu informacyjnego; kolejne punkty rozdzielone znakiem {@code |}. */
    @Column(name = "features", length = 1000)
    private String features;

    @Column(name = "active", nullable = false)
    private boolean active;

    /**
     * Taśmy bębnów gry podstawowej (tylko {@link EngineType#LINES}); kolumna tekstowa, uzasadnienie
     * w {@link ReelStrips}. Gry klastrowe losują każde pole z wag symboli ({@link SlotSymbol#getWeight()}).
     */
    @Convert(converter = ReelStripsConverter.class)
    @Column(name = "reel_strips", length = 4000)
    private ReelStrips reelStrips;

    /** Osobne taśmy darmowych spinów (np. więcej WILD); {@code null} = te same co w grze podstawowej. */
    @Convert(converter = ReelStripsConverter.class)
    @Column(name = "free_reel_strips", length = 4000)
    private ReelStrips freeReelStrips;

    /** Linie wygrywające (tylko {@link EngineType#LINES}), zwracane też w {@code GET /api/slots/{code}}. */
    @Convert(converter = PaylinesConverter.class)
    @Column(name = "paylines", length = 1000)
    private Paylines paylines;

    /**
     * Symbole automatu (strona „jeden” relacji 1:N). {@code mappedBy}: kluczem obcym zarządza
     * {@link SlotSymbol#getSlotMachine()}. Kolekcje są domyślnie LAZY, więc lista gier nie ładuje symboli.
     */
    @OneToMany(mappedBy = "slotMachine")
    @OrderBy("sortOrder ASC")
    private List<SlotSymbol> symbols = new ArrayList<>();

    protected SlotMachine() {
    }

    public SlotMachine(String code, String name, EngineType engineType, int reels, int rows, Integer lines,
                       BetLevels betLevels, BigDecimal targetRtp, Volatility volatility, String features) {
        if (engineType == EngineType.LINES && (lines == null || lines <= 0)) {
            throw new IllegalArgumentException("Automat liniowy musi mieć dodatnią liczbę linii");
        }
        this.code = code;
        this.name = name;
        this.engineType = engineType;
        this.grid = new ReelGrid(reels, rows, engineType == EngineType.CLUSTER ? null : lines);
        this.betLevels = betLevels;
        this.minBet = betLevels.min();
        this.maxBet = betLevels.max();
        this.targetRtp = targetRtp;
        this.volatility = volatility;
        this.features = features;
        this.active = true;
    }

    /** Czy zakład jest jednym z dozwolonych poziomów tej gry. */
    public boolean allowsBet(BigDecimal bet) {
        return betLevels.contains(bet);
    }

    /** Punkty opisu funkcji gry (kolumna {@code features} podzielona po {@code |}). */
    public List<String> getFeatureList() {
        if (features == null || features.isBlank()) {
            return List.of();
        }
        return Arrays.stream(features.split("\\|")).map(String::strip).filter(s -> !s.isEmpty()).toList();
    }

    public void deactivate() {
        this.active = false;
    }

    /**
     * Ustawia taśmy i linie gry liniowej (w aplikacji robi to {@code data.sql}, w testach ta metoda).
     *
     * @param base     taśmy gry podstawowej, po jednej na bęben
     * @param free     taśmy darmowych spinów albo {@code null} (wtedy te same co {@code base})
     * @param paylines linie wygrywające, dokładnie {@link #getLines()} sztuk
     */
    public void defineReels(ReelStrips base, ReelStrips free, Paylines paylines) {
        if (engineType != EngineType.LINES) {
            throw new IllegalStateException("Taśmy i linie mają tylko automaty liniowe");
        }
        int reels = grid.getReels();
        if (base.reelCount() != reels || (free != null && free.reelCount() != reels)) {
            throw new IllegalArgumentException("Liczba taśm musi być równa liczbie bębnów (" + reels + ")");
        }
        if (paylines.count() != grid.getLines()) {
            throw new IllegalArgumentException("Liczba linii musi wynosić " + grid.getLines());
        }
        this.reelStrips = base;
        this.freeReelStrips = free;
        this.paylines = paylines;
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public EngineType getEngineType() {
        return engineType;
    }

    public ReelGrid getGrid() {
        return grid;
    }

    public int getReels() {
        return grid.getReels();
    }

    public int getRows() {
        return grid.getRows();
    }

    public Integer getLines() {
        return grid.getLines();
    }

    public BetLevels getBetLevels() {
        return betLevels;
    }

    public BigDecimal getMinBet() {
        return minBet;
    }

    public BigDecimal getMaxBet() {
        return maxBet;
    }

    public BigDecimal getTargetRtp() {
        return targetRtp;
    }

    public Volatility getVolatility() {
        return volatility;
    }

    public boolean isActive() {
        return active;
    }

    public ReelStrips getReelStrips() {
        return reelStrips;
    }

    public ReelStrips getFreeReelStrips() {
        return freeReelStrips;
    }

    public Paylines getPaylines() {
        return paylines;
    }

    /** Symbole tylko do odczytu (dodaje się je przez zapis {@link SlotSymbol}). */
    public List<SlotSymbol> getSymbols() {
        return Collections.unmodifiableList(symbols);
    }
}
