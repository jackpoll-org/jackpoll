package org.acme.filter;

import io.quarkus.runtime.StartupEvent;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.handler.CorsHandler;
import io.vertx.core.http.HttpMethod;
import io.vertx.core.Vertx;
import jakarta.enterprise.event.Observes;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.jboss.logging.Logger;

/**
 * Registers a Vert.x CORS handler that runs BEFORE the JAX-RS / OIDC layer.
 * This is the recommended approach when Quarkus's built-in CORS properties
 * don't work (e.g., when OIDC intercepts requests before the CORS filter).
 *
 * <p>The allow-list mirrors {@code quarkus.http.cors.*} in application.properties
 * (same {@code CORS_ORIGINS} env var) — keep the two in sync.
 */
public class CorsFilter {

    private static final Logger LOG = Logger.getLogger(CorsFilter.class);

    private static final String ALLOWED_ORIGINS =
            System.getenv().getOrDefault("CORS_ORIGINS", "http://localhost:3000");

    void registerCorsHandler(@Observes StartupEvent event, Router router, Vertx vertx) {
        List<String> origins = List.of(ALLOWED_ORIGINS.split(",")).stream()
                .map(String::trim)
                .filter(o -> !o.isEmpty())
                .collect(Collectors.toList());

        // A wildcard origin combined with credentials is invalid per the CORS
        // spec and a dangerous misconfiguration (any site could ride the user's
        // cookies). Refuse to send credentials when a "*" origin is present, and
        // log loudly so the operator fixes CORS_ORIGINS to an explicit list.
        boolean wildcard = origins.stream().anyMatch(o -> o.equals("*"));
        boolean allowCredentials = !wildcard;
        if (wildcard) {
            LOG.warnf("CORS_ORIGINS contains a wildcard ('*'); disabling "
                    + "credentialed CORS. Set an explicit origin allow-list to "
                    + "allow cookies/Authorization across origins.");
        }

        CorsHandler corsHandler = CorsHandler.create()
                .addOrigins(origins)
                .allowedMethods(Set.of(
                        HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT,
                        HttpMethod.DELETE, HttpMethod.OPTIONS))
                .allowedHeaders(Set.of("Authorization", "Content-Type"))
                .exposedHeaders(Set.of("Set-Cookie"))
                .allowCredentials(allowCredentials)
                .maxAgeSeconds(86400);

        // Register at the very beginning of the route chain (order = -100)
        router.route().order(-100).handler(corsHandler);
    }
}