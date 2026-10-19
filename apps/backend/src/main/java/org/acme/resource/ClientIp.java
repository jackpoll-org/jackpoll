package org.acme.resource;

import io.vertx.core.http.HttpServerRequest;

/**
 * Real client IP for per-IP rate limiting. Traefik appends the true client
 * address as the LAST X-Forwarded-For hop, so take the rightmost hop — the
 * leftmost is attacker-controlled and would mint a fresh bucket per request.
 */
final class ClientIp {

    private ClientIp() {}

    static String of(String forwardedFor, HttpServerRequest http) {
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            String[] hops = forwardedFor.split(",");
            return hops[hops.length - 1].trim();
        }
        return http != null && http.remoteAddress() != null
            ? http.remoteAddress().hostAddress()
            : null;
    }
}
