package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.acme.exception.SpamRejectedException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class OutboundUrlGuardTest {

    private final OutboundUrlGuard guard = new OutboundUrlGuard();

    @ParameterizedTest
    @ValueSource(strings = {
        "http://127.0.0.1/", "http://10.0.0.1/", "http://192.168.1.1/", "http://169.254.169.254/",
        "http://100.64.0.1/", "http://0.0.0.0/", "http://[::1]/", "http://[fd00::1]/",
        "http://[::ffff:127.0.0.1]/", "file:///etc/passwd", "gopher://93.184.216.34/", "not a url",
        "http://192.0.0.8/", "http://198.18.0.1/", "http://240.0.0.1/", "http://255.255.255.255/",
        "http://[64:ff9b::7f00:1]/", "http://[2002:7f00:1::]/", "http://[::7f00:1]/",
        "http://192.88.99.1/", "http://[2001:0:4136:e378::1]/"
    })
    void rejectsInternalAndNonHttpTargets(String url) {
        assertThrows(SpamRejectedException.class, () -> guard.ensureAllowed(url));
    }

    @Test
    void allowsPublicHttpsTargets() {
        assertDoesNotThrow(() -> guard.ensureAllowed("https://93.184.216.34/push/abc"));
        assertDoesNotThrow(() -> guard.ensureAllowed("https://[2606:4700:4700::1111]/"));
    }
}
