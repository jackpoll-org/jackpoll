package org.acme.resource;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class ClientIpTest {

    @Test
    void ipv6HostsShareTheirSlash64() {
        assertEquals("2001:db8:1:2::/64", ClientIp.bucket("2001:db8:1:2:aaaa:bbbb:cccc:dddd"));
        assertEquals(ClientIp.bucket("2001:db8:1:2::1"), ClientIp.bucket("2001:db8:1:2::ffff"));
    }

    @Test
    void ipv4AndUnknownStayAsTheyAre() {
        assertEquals("203.0.113.9", ClientIp.bucket("203.0.113.9"));
        assertEquals("unknown", ClientIp.bucket(null));
    }
}
