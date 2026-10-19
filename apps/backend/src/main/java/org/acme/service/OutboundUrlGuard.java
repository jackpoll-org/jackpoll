package org.acme.service;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.List;
import java.util.stream.Stream;

import org.acme.exception.SpamRejectedException;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import jakarta.enterprise.context.ApplicationScoped;

/**
 * SSRF guard for URLs the server calls on a user's behalf (webhooks, Web Push
 * endpoints): only http(s) to publicly routable addresses, unless
 * {@code survey.webhook.allow-private} is on (dev/test).
 */
@ApplicationScoped
public class OutboundUrlGuard {

    /** Special-purpose ranges the InetAddress predicates below do not cover (RFC 6890, RFC 6052, RFC 3056). */
    private static final List<Cidr> BLOCKED = Stream.of(
        "0.0.0.0/8", "100.64.0.0/10", "192.0.0.0/24", "192.0.2.0/24", "192.88.99.0/24", "198.18.0.0/15",
        "198.51.100.0/24", "203.0.113.0/24", "240.0.0.0/4",
        "fc00::/7", "64:ff9b::/96", "64:ff9b:1::/48", "2001::/32", "2001:db8::/32", "2002::/16", "::/96"
    ).map(Cidr::parse).toList();

    @ConfigProperty(name = "survey.webhook.allow-private", defaultValue = "false")
    boolean allowPrivate;

    public void ensureAllowed(String url) {
        URI uri;
        try {
            uri = URI.create(url);
        } catch (Exception e) {
            throw new SpamRejectedException("Invalid URL.");
        }
        var scheme = uri.getScheme();
        if (scheme == null || !(scheme.equals("http") || scheme.equals("https")) || uri.getHost() == null) {
            throw new SpamRejectedException("URL must use http or https.");
        }
        if (allowPrivate) return;
        try {
            for (InetAddress addr : InetAddress.getAllByName(uri.getHost())) {
                if (!isPublic(addr)) {
                    throw new SpamRejectedException("URL must point to a public address.");
                }
            }
        } catch (SpamRejectedException e) {
            throw e;
        } catch (Exception e) {
            throw new SpamRejectedException("Host could not be resolved.");
        }
    }

    static boolean isPublic(InetAddress addr) {
        if (addr.isLoopbackAddress() || addr.isAnyLocalAddress() || addr.isLinkLocalAddress()
                || addr.isSiteLocalAddress() || addr.isMulticastAddress()) {
            return false;
        }
        byte[] address = addr.getAddress();
        return BLOCKED.stream().noneMatch(range -> range.contains(address));
    }

    private record Cidr(byte[] prefix, int bits) {

        static Cidr parse(String cidr) {
            var parts = cidr.split("/");
            try {
                return new Cidr(InetAddress.getByName(parts[0]).getAddress(), Integer.parseInt(parts[1]));
            } catch (UnknownHostException e) {
                throw new IllegalArgumentException(cidr, e);
            }
        }

        boolean contains(byte[] address) {
            if (address.length != prefix.length) return false;
            for (int i = 0; i < bits; i++) {
                int mask = 0x80 >> (i % 8);
                if ((address[i / 8] & mask) != (prefix[i / 8] & mask)) return false;
            }
            return true;
        }
    }
}
