package org.acme.resource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

class ClientIpTest {

    @Test
    void ipv6HostsShareTheirSlash64() {
        assertEquals("2001:db8:1:2:0:0:0:0/64", ClientIp.bucket("2001:db8:1:2:aaaa:bbbb:cccc:dddd"));
        assertEquals(ClientIp.bucket("2001:db8:1:2::1"), ClientIp.bucket("2001:db8:1:2::ffff"));
    }

    @Test
    void compressedZeroGroupsInThePrefixStillMapToOneSlash64() {
        assertEquals(ClientIp.bucket("2600:3c03::abcd:1:2:3"), ClientIp.bucket("2600:3c03::1234:1:2:3"));
        assertEquals("2600:3c03:0:0:0:0:0:0/64", ClientIp.bucket("2600:3c03::abcd:1:2:3"));
    }

    @Test
    void wideBucketGroupsAnIpv6Slash48AndKeepsIpv4() {
        assertEquals("2001:db8:1:0:0:0:0:0/48", ClientIp.wideBucket("2001:db8:1:2::1"));
        assertEquals(ClientIp.wideBucket("2001:db8:1:2::1"), ClientIp.wideBucket("2001:db8:1:ffff::9"));
        assertEquals("203.0.113.9", ClientIp.wideBucket("203.0.113.9"));
        assertEquals("unknown", ClientIp.wideBucket(null));
    }

    @Test
    void ipv4AndUnknownStayAsTheyAre() {
        assertEquals("203.0.113.9", ClientIp.bucket("203.0.113.9"));
        assertEquals("unknown", ClientIp.bucket(null));
        assertEquals(".:a", ClientIp.bucket(".:a"));
    }

    private static final List<ClientIp.Cidr> TRUSTED = ClientIp.parseTrusted(ClientIp.DEFAULT_TRUSTED_PROXIES);

    @Test
    void forwardedForIsHonouredOnlyFromATrustedProxy() {
        assertEquals("203.0.113.9", ClientIp.of("198.51.100.1, 203.0.113.9", "10.0.3.7", TRUSTED));
        assertEquals("203.0.113.9", ClientIp.of("203.0.113.9", "::1", TRUSTED));
        assertEquals("198.51.100.20", ClientIp.of("203.0.113.9", "198.51.100.20", TRUSTED));
        assertEquals("198.51.100.20", ClientIp.of("203.0.113.9", "198.51.100.20", List.<ClientIp.Cidr>of()));
    }

    @Test
    void nonIpHopFallsBackToThePeer() {
        assertEquals("10.0.3.7", ClientIp.of("203.0.113.9, not-an-ip", "10.0.3.7", TRUSTED));
        assertEquals("10.0.3.7", ClientIp.of("example.com", "10.0.3.7", TRUSTED));
        assertEquals("10.0.3.7", ClientIp.of(" ", "10.0.3.7", TRUSTED));
    }

    @Test
    void cidrMatchingRespectsPrefixAndFamily() {
        assertTrue(ClientIp.inAny("172.31.255.255", TRUSTED));
        assertFalse(ClientIp.inAny("172.32.0.1", TRUSTED));
        assertTrue(ClientIp.inAny("fd12::1", TRUSTED));
        assertTrue(ClientIp.inAny("::ffff:192.168.1.2", TRUSTED));
        assertFalse(ClientIp.inAny("2001:db8::1", TRUSTED));
        assertFalse(ClientIp.inAny(null, TRUSTED));
        assertTrue(ClientIp.inAny("192.0.2.5", ClientIp.parseTrusted(List.of("192.0.2.5"))));
    }

    @Test
    void noneTrustsNoProxy() {
        assertTrue(ClientIp.parseTrusted(List.of("none")).isEmpty());
        assertEquals("10.0.3.7", ClientIp.of("203.0.113.9", "10.0.3.7", ClientIp.parseTrusted(List.of("none"))));
    }

    @Test
    void malformedTrustedProxiesAreRejected() {
        for (var bad : List.of("10.0.0.0/33", "::1/129", "10.0.0.0/-1", "10.0.0.0/x", "10.0.0.0/", "not-an-ip", "none")) {
            var entries = "none".equals(bad) ? List.of("10.0.0.0/8", bad) : List.of(bad);
            assertThrows(IllegalArgumentException.class, () -> ClientIp.parseTrusted(entries), bad);
        }
        assertEquals(2, ClientIp.parseTrusted(List.of("10.0.0.0/0", "::/128")).size());
    }
}
