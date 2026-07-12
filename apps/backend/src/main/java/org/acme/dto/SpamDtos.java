package org.acme.dto;

/** DTOs for spam & bot protection (issue #31). */
public final class SpamDtos {

    private SpamDtos() {}

    /** Signed token issued when a respondent opens the form (timing check). */
    public record BeginResponse(String beginToken) {}

    /** Altcha proof-of-work challenge sent to the widget. */
    public record AltchaChallenge(
        String algorithm,
        String challenge,
        long maxnumber,
        String salt,
        String signature
    ) {}
}
