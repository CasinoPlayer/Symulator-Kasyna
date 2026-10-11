package pl.wsb.kasyno.shared.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import pl.wsb.kasyno.account.api.PlayerProfiles;
import pl.wsb.kasyno.account.web.MeController;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Nagłówki cache dla assetów (pliki testowe w {@code src/test/resources/static/assets/test/}).
 */
@WebMvcTest(controllers = MeController.class)
@ActiveProfiles("test")
@DisplayName("WebConfig: cache assetów")
class WebConfigTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private PlayerProfiles playerProfiles;

    @Test
    @DisplayName("/assets/** → Cache-Control: public, max-age=86400")
    void assetsAreCachedForADay() throws Exception {
        mvc.perform(get("/assets/test/probe.txt"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("max-age=86400")))
                .andExpect(header().string("Cache-Control", containsString("public")));
    }

    @Test
    @DisplayName("manifest.json → Cache-Control: no-cache (zawsze sprawdzamy świeżość)")
    void manifestIsAlwaysRevalidated() throws Exception {
        mvc.perform(get("/assets/test/manifest.json"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-cache"));
    }
}
