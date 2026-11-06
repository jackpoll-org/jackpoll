package org.acme.resource;

import io.vertx.core.http.HttpServerRequest;

/**
 * Real client IP for per-IP rate limiting. Traefik appends the true client
 * address as the LAST X-Forwarded-For hop, so take the rightmost hop — the
 * leftmost is attacker-controlled and would mint a fresh bucket per request.
 */
public final class ClientIp {

    private ClientIp() {}

    /** The rate-limit bucket for {@code ip}: an IPv6 host can use a whole /64, so it counts as one. */
    public static String bucket(String ip) {
        if (ip == null) return "unknown";
        if (!ip.contains(":")) return ip;
        String[] groups = ip.split(":", -1);
        return groups.length >= 4 ? String.join(":", groups[0], groups[1], groups[2], groups[3]) + "::/64" : ip;
    }

    public static String of(String forwardedFor, HttpServerRequest http) {
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            String[] hops = forwardedFor.split(",");
            return hops[hops.length - 1].trim();
        }
        return http != null && http.remoteAddress() != null
            ? http.remoteAddress().hostAddress()
            : null;
    }
}
