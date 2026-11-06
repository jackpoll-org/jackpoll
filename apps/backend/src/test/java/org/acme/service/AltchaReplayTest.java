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

    @Test
    void beginTokensExpireAfterADay() {
        long now = java.time.Instant.now().getEpochSecond();
        long old = now - SpamProtectionService.BEGIN_TOKEN_MAX_AGE_SECONDS - 60;
        String fresh = (now - 10) + "." + spam.hmacHex("survey-a:" + (now - 10));
        String stale = old + "." + spam.hmacHex("survey-a:" + old);

        assertDoesNotThrow(() -> spam.verifyTiming("survey-a", fresh, 0));
        assertThrows(SpamRejectedException.class, () -> spam.verifyTiming("survey-a", stale, 0));
    }
}
