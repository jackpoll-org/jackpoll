package org.acme.service;

import org.acme.exception.RateLimitedException;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.NotFoundException;

/**
 * Shared gate + rate limiter for the diagnostic ("debug") endpoints. Kept in one
 * place so the test-push and test-email endpoints enforce the same policy.
 */
@ApplicationScoped
public class DebugTools {

    /** When false the debug endpoints behave as if they don't exist (404). */
    @ConfigProperty(name = "app.debug-tools-enabled", defaultValue = "true")
    boolean enabled;

    @Inject
    RateLimiterService rateLimiter;

    public boolean isEnabled() {
        return enabled;
    }

    /** 404 when debug tools are disabled for this instance. */
    public void ensureEnabled() {
        if (!enabled) throw new NotFoundException();
    }

    /** Allow at most one call per minute per user per action. */
    public void rateLimit(String userId, String action) {
        if (!rateLimiter.allow("debug|" + action + "|" + userId, 1, 60)) {
            throw new RateLimitedException(
                "Please wait a minute before sending another test.");
        }
    }
}
