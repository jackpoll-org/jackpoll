package org.acme.integration;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.acme.exception.InvalidUploadException;
import org.acme.service.ClamAvScanner;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;

/**
 * Real-service check of the clamd virus scanner (issue #43). Runs only when a
 * clamd is reachable on localhost:3310 (e.g. docker run clamav/clamav);
 * otherwise skipped so CI without clamd stays green.
 */
@QuarkusTest
@TestProfile(ClamAvScanIT.ClamAvProfile.class)
class ClamAvScanIT {

    public static class ClamAvProfile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                "survey.upload.clamav.enabled", "true",
                "survey.upload.clamav.host", "localhost",
                "survey.upload.clamav.port", "3310",
                "survey.upload.clamav.fail-open", "false");
        }
    }

    // The standard EICAR antivirus test string — detected by any clamd with
    // up-to-date definitions, harmless otherwise.
    private static final byte[] EICAR =
        ("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*")
            .getBytes(StandardCharsets.US_ASCII);

    @Inject
    ClamAvScanner scanner;

    @BeforeEach
    void requireClamd() {
        Assumptions.assumeTrue(reachable("localhost", 3310),
            "clamd not reachable on localhost:3310 — skipping");
    }

    @Test
    void cleanContentPasses() {
        assertDoesNotThrow(() -> scanner.scan("just some harmless text".getBytes()));
    }

    @Test
    void eicarSignatureIsRejected() {
        assertThrows(InvalidUploadException.class, () -> scanner.scan(EICAR));
    }

    private static boolean reachable(String host, int port) {
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress(host, port), 1000);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
