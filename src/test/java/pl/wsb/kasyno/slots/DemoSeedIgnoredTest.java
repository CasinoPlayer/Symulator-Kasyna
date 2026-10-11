package pl.wsb.kasyno.slots;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import pl.wsb.kasyno.shared.config.CasinoProperties;
import pl.wsb.kasyno.slots.web.SlotController;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Bezpieczeństwo: poza profilem {@code demo} ({@code kasyno.demo.allow-seed=false}, wartość domyślna i ustawienie
 * profili {@code dev}, {@code prod}, {@code test}) nagłówek {@code X-Demo-Seed} nie ma żadnego wpływu na rundę.
 * Gdyby działał, gracz mógłby powtarzać ziarno znanej sobie wygrywającej rundy.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("X-Demo-Seed poza profilem demo jest ignorowany")
class DemoSeedIgnoredTest {

    private static final String SEED = "5f3a9c0e7b21d4a8";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private CasinoProperties properties;

    private MockHttpSession login(String nick) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"nick\":\"" + nick + "\"}")).andExpect(status().isOk()).andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private MvcResult spinWithSeed(MockHttpSession session, String seed) throws Exception {
        return mvc.perform(post("/api/slots/zloty-faraon/spins").session(session)
                        .header(SlotController.DEMO_SEED_HEADER, seed)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"bet\":20}"))
                .andExpect(status().isOk())
                .andReturn();
    }

    private static String seedOf(MvcResult result) throws Exception {
        return JsonPath.read(result.getResponse().getContentAsString(), "$.seed");
    }

    @Test
    @DisplayName("ziarno rundy losowe mimo nagłówka; dwa spiny z tym samym nagłówkiem mają różne ziarna")
    void headerHasNoEffect() throws Exception {
        assertThat(properties.demo().allowSeed()).isFalse();
        MockHttpSession session = login("Bez_Demo");

        String first = seedOf(spinWithSeed(session, SEED));
        String second = seedOf(spinWithSeed(session, SEED));

        assertThat(first).isNotEqualTo(SEED);
        assertThat(second).isNotEqualTo(SEED).isNotEqualTo(first);
    }

    @Test
    @DisplayName("niepoprawny nagłówek też jest po prostu pomijany (200, a nie 400)")
    void malformedHeaderIgnored() throws Exception {
        MockHttpSession session = login("Bez_Demo_2");

        String seed = seedOf(spinWithSeed(session, "to-nie-jest-liczba"));

        assertThat(seed).hasSize(16);
    }
}
