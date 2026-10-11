package pl.wsb.kasyno.shared.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import pl.wsb.kasyno.shared.error.NotLoggedInException;

/**
 * Wstawia identyfikator zalogowanego gracza do parametrów oznaczonych {@link CurrentPlayer}.
 *
 * <p>Spring MVC przed wywołaniem metody kontrolera pyta każdy zarejestrowany {@link HandlerMethodArgumentResolver},
 * czy umie dostarczyć dany parametr ({@link #supportsParameter}). Nasz umie dla {@code @CurrentPlayer Long}.
 * Rejestracja: {@link pl.wsb.kasyno.shared.config.WebConfig}.
 */
@Component
public class CurrentPlayerArgumentResolver implements HandlerMethodArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(CurrentPlayer.class)
                && Long.class.equals(parameter.getParameterType());
    }

    @Override
    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                  NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
        HttpServletRequest request = webRequest.getNativeRequest(HttpServletRequest.class);
        if (request == null) {
            throw new NotLoggedInException();
        }
        return PlayerSession.playerId(request).orElseThrow(NotLoggedInException::new);
    }
}
