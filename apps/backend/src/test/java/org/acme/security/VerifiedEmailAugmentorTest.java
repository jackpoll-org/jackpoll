package org.acme.security;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Map;
import java.util.Set;

import org.eclipse.microprofile.jwt.JsonWebToken;
import org.junit.jupiter.api.Test;

import io.quarkus.security.AuthenticationFailedException;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.security.runtime.QuarkusPrincipal;
import io.quarkus.security.runtime.QuarkusSecurityIdentity;

class VerifiedEmailAugmentorTest {

    private final VerifiedEmailAugmentor augmentor = new VerifiedEmailAugmentor();

    private static JsonWebToken jwt(Map<String, Object> claims) {
        return new JsonWebToken() {
            @Override
            public String getName() {
                return "user";
            }

            @Override
            public Set<String> getClaimNames() {
                return claims.keySet();
            }

            @SuppressWarnings("unchecked")
            @Override
            public <T> T getClaim(String claimName) {
                return (T) claims.get(claimName);
            }
        };
    }

    private SecurityIdentity augment(java.security.Principal principal) {
        var identity = QuarkusSecurityIdentity.builder().setPrincipal(principal).build();
        return augmentor.augment(identity, null).await().indefinitely();
    }

    @Test
    void verifiedTokenPasses() {
        var principal = jwt(Map.of("email_verified", true));
        assertSame(principal, augment(principal).getPrincipal());
    }

    @Test
    void unverifiedTokenIsRejected() {
        assertThrows(AuthenticationFailedException.class,
            () -> augment(jwt(Map.of("email_verified", false))));
        assertThrows(AuthenticationFailedException.class, () -> augment(jwt(Map.of())));
    }

    @Test
    void nonJwtIdentityIsUntouched() {
        var principal = new QuarkusPrincipal("api-key-user");
        assertSame(principal, augment(principal).getPrincipal());
    }
}
