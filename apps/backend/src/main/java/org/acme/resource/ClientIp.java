package org.acme.resource;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.regex.Pattern;

import io.vertx.core.http.HttpServerRequest;

/**
 * Real client IP for per-IP rate limiting. Traefik appends the true client
 * address as the LAST X-Forwarded-For hop, so take the rightmost hop — the
 * leftmost is attacker-controlled and would mint a fresh bucket per request.
 */
public final class ClientIp {

    private static final Pattern IPV6_LITERAL = Pattern.compile("[0-9a-fA-F:][0-9a-fA-F:.]*");

    private ClientIp() {}

    /** The rate-limit bucket for {@code ip}: an IPv6 host can use a whole /64, so it counts as one. */
    public static String bucket(String ip) {
        if (ip == null) return "unknown";
        if (!ip.contains(":") || !IPV6_LITERAL.matcher(ip).matches()) return ip;
        try {
            byte[] address = InetAddress.getByName(ip).getAddress();
            if (address.length != 16) return ip;
            Arrays.fill(address, 8, 16, (byte) 0);
            return InetAddress.getByAddress(address).getHostAddress() + "/64";
        } catch (UnknownHostException e) {
            return ip;
        }
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
