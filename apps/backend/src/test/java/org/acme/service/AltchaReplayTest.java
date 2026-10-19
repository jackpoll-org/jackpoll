package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HexFormat;
import org.acme.exception.SpamRejectedException;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AltchaReplayTest {

    @Inject
    SpamProtectionService spam;

    @Test
    void aSolvedChallengeIsAcceptedOnlyForItsOwnSurvey() throws Exception {
        var challenge = spam.createChallenge("survey-a");
        var digest = MessageDigest.getInstance("SHA-256");
        long number = -1;
        for (long n = 0; n <= challenge.maxnumber(); n++) {
            var hash = HexFormat.of().formatHex(
                digest.digest((challenge.salt() + n).getBytes(StandardCharsets.UTF_8)));
            if (hash.equals(challenge.challenge())) {
                number = n;
                break;
            }
        }
        var json = "{\"algorithm\":\"SHA-256\",\"challenge\":\"" + challenge.challenge()
            + "\",\"number\":" + number + ",\"salt\":\"" + challenge.salt()
            + "\",\"signature\":\"" + challenge.signature() + "\"}";
        var payload = Base64.getEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8));

        assertDoesNotThrow(() -> spam.verifyCaptcha(payload, "survey-a"));
        assertThrows(SpamRejectedException.class, () -> spam.verifyCaptcha(payload, "survey-b"));
    }
}
