package pl.wsb.kasyno.slots.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.util.Objects;

/**
 * Plansza automatu (klasa wbudowana, {@code @Embeddable}): liczba bębnów, rzędów i linii wygrywających.
 *
 * <p>Klasa nie ma własnej tabeli: jej pola to kolumny tabeli {@code slot_machine}, w której jest użyta przez
 * {@code @Embedded} ({@link SlotMachine#getGrid()}). Trzy liczby opisują razem jedną rzecz, rozmiar siatki symboli,
 * więc trzymamy je w jednym obiekcie razem ze sprawdzeniem poprawności. Nazwy kolumn {@code reel_count},
 * {@code row_count}, {@code line_count} zamiast {@code reels/rows/lines}, bo {@code ROWS} jest słowem
 * zastrzeżonym w SQL (H2 odrzuciłby taki DDL).
 */
@Embeddable
public class ReelGrid {

    @Column(name = "reel_count", nullable = false)
    private int reels;

    @Column(name = "row_count", nullable = false)
    private int rows;

    /** Liczba linii wygrywających; {@code null} dla gier klastrowych ({@link EngineType#CLUSTER}). */
    @Column(name = "line_count")
    private Integer lines;

    protected ReelGrid() {
    }

    public ReelGrid(int reels, int rows, Integer lines) {
        if (reels <= 0 || rows <= 0) {
            throw new IllegalArgumentException("Plansza musi mieć dodatnią liczbę bębnów i rzędów");
        }
        if (lines != null && lines <= 0) {
            throw new IllegalArgumentException("Liczba linii musi być dodatnia albo pusta (gra klastrowa)");
        }
        this.reels = reels;
        this.rows = rows;
        this.lines = lines;
    }

    public int getReels() {
        return reels;
    }

    public int getRows() {
        return rows;
    }

    public Integer getLines() {
        return lines;
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof ReelGrid other && reels == other.reels && rows == other.rows
                && Objects.equals(lines, other.lines);
    }

    @Override
    public int hashCode() {
        return Objects.hash(reels, rows, lines);
    }

    @Override
    public String toString() {
        return reels + "×" + rows + (lines == null ? "" : ", linie: " + lines);
    }
}
