package org.acme.resource;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

import org.eclipse.microprofile.config.ConfigProvider;

import io.netty.util.NetUtil;
import io.quarkus.runtime.StartupEvent;
import io.quarkus.websockets.next.HandshakeRequest;
import io.vertx.core.http.HttpServerRequest;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Singleton;

/**
 * Real client IP for per-IP rate limiting. Traefik appends the true client
 * address as the LAST X-Forwarded-For hop, so take the rightmost hop — the
 * leftmost is attacker-controlled and would mint a fresh bucket per request.
 * The header is only believed when the socket peer is a trusted proxy
 * ({@code app.trusted-proxies}); anyone reaching the backend directly could
 * otherwise pick their own bucket.
 */
public final class ClientIp {

    private static final Pattern IPV6_LITERAL = Pattern.compile("[0-9a-fA-F:][0-9a-fA-F:.]*");

    private ClientIp() {}

    /** The rate-limit bucket for {@code ip}: an IPv6 host can use a whole /64, so it counts as one. */
    public static String bucket(String ip) {
        return ipv6Prefix(ip, 64);
    }

    /** A coarser bucket for allowances one caller must not multiply: an IPv6 site gets a whole /48. */
    public static String wideBucket(String ip) {
        return ipv6Prefix(ip, 48);
    }

    private static String ipv6Prefix(String ip, int bits) {
        if (ip == null) return "unknown";
        if (!ip.contains(":") || !IPV6_LITERAL.matcher(ip).matches()) return ip;
        try {
            byte[] address = InetAddress.getByName(ip).getAddress();
            if (address.length != 16) return ip;
            Arrays.fill(address, bits / 8, 16, (byte) 0);
            return InetAddress.getByAddress(address).getHostAddress() + "/" + bits;
        } catch (UnknownHostException e) {
            return ip;
        }
    }

    static final List<String> DEFAULT_TRUSTED_PROXIES = List.of(
        "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8", "::1/128", "fc00::/7");

    record Cidr(byte[] network, int bits) {}

    private static volatile List<Cidr> trustedProxies;

    /** Parses {@code app.trusted-proxies} at startup so a bad entry stops the app instead of every request. */
    @Singleton
    static class TrustedProxiesCheck {
        void onStart(@Observes StartupEvent event) {
            trustedProxies();
        }
    }

    static List<Cidr> trustedProxies() {
        var parsed = trustedProxies;
        if (parsed == null) {
            parsed = parseTrusted(ConfigProvider.getConfig()
                .getOptionalValues("app.trusted-proxies", String.class)
                .orElse(DEFAULT_TRUSTED_PROXIES));
            trustedProxies = parsed;
        }
        return parsed;
    }

    /** CIDRs or bare addresses; the single value {@code none} trusts no proxy. */
    static List<Cidr> parseTrusted(List<String> entries) {
        if (entries.size() == 1 && "none".equalsIgnoreCase(entries.get(0).trim())) return List.of();
        return entries.stream().map(ClientIp::parseCidr).toList();
    }

    private static Cidr parseCidr(String entry) {
        int slash = entry.indexOf('/');
        byte[] network = address(slash < 0 ? entry : entry.substring(0, slash));
        if (network == null) throw new IllegalArgumentException("Invalid app.trusted-proxies entry: " + entry);
        int max = network.length * 8;
        if (slash < 0) return new Cidr(network, max);
        String prefix = entry.substring(slash + 1).trim();
        if (!prefix.matches("\\d{1,3}") || Integer.parseInt(prefix) > max) {
            throw new IllegalArgumentException("Invalid app.trusted-proxies entry: " + entry);
        }
        return new Cidr(network, Integer.parseInt(prefix));
    }

    public static String of(String forwardedFor, HttpServerRequest http) {
        String peer = http != null && http.remoteAddress() != null
            ? http.remoteAddress().hostAddress()
            : null;
        return of(forwardedFor, peer, trustedProxies());
    }

    /** The WebSocket handshake reports the peer as {@code host:port}. */
    public static String of(HandshakeRequest handshake) {
        String remote = handshake.remoteAddress();
        int port = remote == null || NetUtil.isValidIpV6Address(remote) ? -1 : remote.lastIndexOf(':');
        String peer = port < 0 ? remote : remote.substring(0, port).replace("[", "").replace("]", "");
        return of(handshake.header("X-Forwarded-For"), peer, trustedProxies());
    }

    static String of(String forwardedFor, String peer, List<Cidr> trustedProxies) {
        if (forwardedFor == null || forwardedFor.isBlank() || !inAny(peer, trustedProxies)) return peer;
        String[] hops = forwardedFor.split(",");
        String hop = hops[hops.length - 1].trim();
        return NetUtil.isValidIpV4Address(hop) || NetUtil.isValidIpV6Address(hop) ? hop : peer;
    }

    static boolean inAny(String ip, List<Cidr> cidrs) {
        byte[] address = address(ip);
        if (address == null) return false;
        for (Cidr cidr : cidrs) {
            if (cidr.network().length == address.length && prefixMatches(address, cidr.network(), cidr.bits())) {
                return true;
            }
        }
        return false;
    }

    private static boolean prefixMatches(byte[] address, byte[] network, int bits) {
        for (int i = 0; i < bits; i++) {
            int mask = 0x80 >> (i % 8);
            if ((address[i / 8] & mask) != (network[i / 8] & mask)) return false;
        }
        return true;
    }

    private static byte[] address(String ip) {
        byte[] raw = ip == null ? null : NetUtil.createByteArrayFromIpAddressString(ip.trim());
        if (raw == null) return null;
        try {
            return InetAddress.getByAddress(raw).getAddress();
        } catch (UnknownHostException e) {
            return null;
        }
    }
}
