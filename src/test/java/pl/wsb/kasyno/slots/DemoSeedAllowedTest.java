package pl.wsb.kasyno.slots;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.test.web.servlet.ResultActions;
import pl.wsb.kasyno.slots.web.SlotController;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Profil {@code demo} ({@code kasyno.demo.allow-seed=true}, jak w {@code application-demo.properties}): ziarno rundy
 * z nagłówka {@code X-Demo-Seed}, więc ta sama runda daje się odegrać ponownie (nagrywanie filmików do lobby).
 */
@SpringBootTest(properties = "kasyno.demo.allow-seed=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("X-Demo-Seed w profilu demo: ziarno rundy = podane")
class DemoSeedAllowedTest {

    private static final String SEED = "5f3a9c0e7b21d4a8";
    private static final ObjectMapper JSON = new ObjectMapper();

    @Autowired
    private MockMvc mvc;

    private MockHttpSession login(String nick) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"nick\":\"" + nick + "\"}")).andExpect(status().isOk()).andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private ResultActions spin(MockHttpSession session, String game, long bet, String seed) throws Exception {
        var request = post("/api/slots/" + game + "/spins").session(session)
                .contentType(MediaType.APPLICATION_JSON).content("{\"bet\":" + bet + "}");
        if (seed != null) {
            request.header(SlotController.DEMO_SEED_HEADER, seed);
        }
        return mvc.perform(request);
    }

    private static JsonNode body(ResultActions actions) throws Exception {
        return JSON.readTree(actions.andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    @Test
    @DisplayName("ten sam X-Demo-Seed u dwóch graczy: to samo ziarno w odpowiedzi i identyczne kroki rundy")
    void sameSeedSameRound() throws Exception {
        JsonNode first = body(spin(login("Demo_Pierwszy"), "zloty-faraon", 20, SEED));
        JsonNode second = body(spin(login("Demo_Drugi"), "zloty-faraon", 20, "0x" + SEED.toUpperCase()));

        assertThat(first.get("seed").asText()).isEqualTo(SEED);
        assertThat(second.get("seed").asText()).isEqualTo(SEED);
        assertThat(second.get("steps")).isEqualTo(first.get("steps"));
        assertThat(second.get("totalWin")).isEqualTo(first.get("totalWin"));
    }

    @Test
    @DisplayName("bez nagłówka ziarno nadal losowe (nagłówek jest opcjonalny także w demo)")
    void withoutHeaderRandom() throws Exception {
        MockHttpSession session = login("Demo_Losowy");

        String a = body(spin(session, "cebulowy-777", 10, null)).get("seed").asText();
        String b = body(spin(session, "cebulowy-777", 10, null)).get("seed").asText();

        assertThat(a).isNotEqualTo(b);
    }

    @Test
    @DisplayName("niepoprawny X-Demo-Seed → 400 VALIDATION_FAILED, zakład nie jest pobrany")
    void invalidSeed() throws Exception {
        MockHttpSession session = login("Demo_Zly");

        spin(session, "cebulowy-777", 10, "zzz")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        spin(session, "cebulowy-777", 10, "12345678901234567")
                .andExpect(status().isBadRequest());

        mvc.perform(get("/api/me").session(session)).andExpect(jsonPath("$.balance").value(10000));
        mvc.perform(get("/api/me/history").session(session)).andExpect(jsonPath("$.totalItems").value(0));
    }
}
