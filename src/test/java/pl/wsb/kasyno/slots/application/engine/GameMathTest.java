package pl.wsb.kasyno.slots.application.engine;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import pl.wsb.kasyno.slots.domain.SlotMachine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static pl.wsb.kasyno.slots.application.engine.EngineFixtures.clusterMachine;
import static pl.wsb.kasyno.slots.application.engine.EngineFixtures.linesMachine;
import static pl.wsb.kasyno.slots.application.engine.EngineFixtures.symbols;

@DisplayName("GameMath: kompilacja konfiguracji gry i wykrywanie błędnych danych")
class GameMathTest {

    @Test
    @DisplayName("wypłaty w setnych: linie za dokładną liczbę, klastry i scatter „co najmniej”")
    void paysInHundredths() {
        SlotMachine machine = linesMachine(3, 3, "1,1,1", new String[][]{{"x,y,s", "x,y,s", "x,y,s"}});
        GameMath math = GameMath.of(machine, symbols(machine, "x NORMAL 1 3:1.5", "y NORMAL 1 3:10",
                "s SCATTER 1 2:1,3:4"));

        assertThat(math.linePay(0, 3)).isEqualTo(150);
        assertThat(math.linePay(0, 2)).isZero();
        assertThat(math.atLeastPay(2, 2)).isEqualTo(100);
        assertThat(math.atLeastPay(2, 9)).isEqualTo(400);
        assertThat(math.scatter()).isEqualTo(2);
        assertThat(math.wild()).isEqualTo(GameMath.NONE);
    }

    @Test
    @DisplayName("nieznany symbol na taśmie → czytelny błąd konfiguracji")
    void unknownSymbolOnStrip() {
        SlotMachine machine = linesMachine(3, 3, "1,1,1", new String[][]{{"x,y,q", "x,y,x", "x,y,x"}});

        assertThatThrownBy(() -> GameMath.of(machine, symbols(machine, "x NORMAL 1 3:1", "y NORMAL 1 3:2")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("nieznany symbol „q”");
    }

    @Test
    @DisplayName("wypłata z ułamkiem groszy (3 miejsca po przecinku) → błąd konfiguracji")
    void rejectsSubCentPays() {
        SlotMachine machine = linesMachine(3, 3, "1,1,1", new String[][]{{"x,y,x", "x,y,x", "x,y,x"}});

        assertThatThrownBy(() -> GameMath.of(machine, symbols(machine, "x NORMAL 1 3:1.125", "y NORMAL 1 3:2")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("więcej niż 2 miejsca");
    }

    @Test
    @DisplayName("gra klastrowa: kula mnożnika wypada tylko w darmowych spinach")
    void multiplierOnlyInFreeSpins() {
        SlotMachine machine = clusterMachine();
        GameMath math = GameMath.of(machine, symbols(machine, "a NORMAL 1 5:1", "m MULTIPLIER 1000000"));

        for (int i = 0; i < 1_000; i++) {
            assertThat(math.drawSymbol(RandomSource.fromSeed(i), false)).isZero();
        }
        assertThat(math.drawSymbol(EngineFixtures.ScriptedRandom.constant(1), true)).isEqualTo(1);
    }
}
