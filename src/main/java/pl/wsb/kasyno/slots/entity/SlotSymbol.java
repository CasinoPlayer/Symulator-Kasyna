package pl.wsb.kasyno.slots.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Symbol automatu i jego wypłaty (tabela {@code slot_symbol}, relacja N:1 z {@link SlotMachine}).
 *
 * <p>{@code code} to identyfikator używany przez front i grafikę, np. {@code siodemka} → obraz {@code s1_sym_siodemka}.
 * {@code weight} to waga losowania (im większa, tym częściej symbol wypada); dokładne taśmy bębnów
 * i matematykę gier opisuje {@code docs/projekt/07-gry-i-matematyka.md}.
 */
@Entity
@Table(name = "slot_symbol",
        uniqueConstraints = @UniqueConstraint(name = "uk_slot_symbol_machine_code", columnNames = {"slot_machine_id", "code"}))
public class SlotSymbol {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "slot_machine_id", nullable = false)
    private SlotMachine slotMachine;

    @Column(name = "code", nullable = false, length = 30)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 20)
    private SymbolKind kind;

    @Column(name = "weight", nullable = false)
    private int weight;

    /** Wypłaty, np. {@code "3:5,4:20,5:100"}; kolumna tekstowa z konwerterem (opis w {@link Payouts}). */
    @Convert(converter = PayoutsConverter.class)
    @Column(name = "pays", length = 200)
    private Payouts pays;

    /** Kolejność w tabeli wypłat (od najniższego symbolu). */
    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected SlotSymbol() {
    }

    public SlotSymbol(SlotMachine slotMachine, String code, SymbolKind kind, int weight, Payouts pays, int sortOrder) {
        if (weight < 0) {
            throw new IllegalArgumentException("Waga symbolu nie może być ujemna");
        }
        this.slotMachine = slotMachine;
        this.code = code;
        this.kind = kind;
        this.weight = weight;
        this.pays = pays == null ? Payouts.none() : pays;
        this.sortOrder = sortOrder;
    }

    public Long getId() {
        return id;
    }

    public SlotMachine getSlotMachine() {
        return slotMachine;
    }

    public String getCode() {
        return code;
    }

    public SymbolKind getKind() {
        return kind;
    }

    public int getWeight() {
        return weight;
    }

    public Payouts getPays() {
        return pays;
    }

    public int getSortOrder() {
        return sortOrder;
    }
}
