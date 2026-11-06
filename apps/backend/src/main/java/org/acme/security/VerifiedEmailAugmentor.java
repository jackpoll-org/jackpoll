package org.acme.security;

import org.eclipse.microprofile.jwt.JsonWebToken;

import io.quarkus.security.AuthenticationFailedException;
import io.quarkus.security.identity.AuthenticationRequestContext;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.security.identity.SecurityIdentityAugmentor;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class VerifiedEmailAugmentor implements SecurityIdentityAugmentor {

    @Override
    public Uni<SecurityIdentity> augment(SecurityIdentity identity, AuthenticationRequestContext context) {
        if (identity.getPrincipal() instanceof JsonWebToken jwt
            && !Boolean.TRUE.equals(jwt.getClaim("email_verified"))) {
            return Uni.createFrom().failure(new AuthenticationFailedException("Email not verified"));
        }
        return Uni.createFrom().item(identity);
    }
}
