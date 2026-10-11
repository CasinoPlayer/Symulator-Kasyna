package pl.wsb.kasyno.slots.application.engine;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("SlotEngineRegistry: silnik po kodzie gry")
class SlotEngineRegistryTest {

    /** Rejestr zbudowany z podanych beanów, tak jak zrobiłby to Spring. */
    static SlotEngineRegistry registryOf(Map<String, SlotEngine> beans) {
        return new SlotEngineRegistry(new StaticListableBeanFactory(Map.copyOf(beans)).getBeanProvider(SlotEngine.class));
    }

    @Test
    @DisplayName("znajduje silnik po kodzie gry; brak silnika = pusty wynik")
    void findsEngineByGameCode() {
        FakeSlotEngine s1 = new FakeSlotEngine("cebulowy-777");
        SlotEngineRegistry registry = registryOf(Map.of("s1", s1));

        assertThat(registry.find("cebulowy-777")).containsSame(s1);
        assertThat(registry.find("zloty-faraon")).isEmpty();
        assertThat(registry.supportedGames()).containsExactly("cebulowy-777");
    }

    @Test
    @DisplayName("aplikacja startuje bez żadnego silnika")
    void worksWithoutEngines() {
        assertThat(registryOf(Map.of()).find("cebulowy-777")).isEmpty();
    }

    @Test
    @DisplayName("dwa silniki dla tej samej gry to błąd konfiguracji")
    void rejectsDuplicates() {
        assertThatThrownBy(() -> registryOf(Map.of(
                "a", new FakeSlotEngine("cebulowy-777"),
                "b", new FakeSlotEngine("cebulowy-777"))))
                .isInstanceOf(IllegalStateException.class);
    }
}
