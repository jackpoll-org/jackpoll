package org.acme.security;

import java.util.Set;

import org.acme.service.ApiKeyService;

import io.quarkus.security.AuthenticationFailedException;
import io.quarkus.security.identity.AuthenticationRequestContext;
import io.quarkus.security.identity.IdentityProvider;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.security.runtime.QuarkusPrincipal;
import io.quarkus.security.runtime.QuarkusSecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.context.control.ActivateRequestContext;
import jakarta.inject.Inject;

@ApplicationScoped
public class ApiKeyIdentityProvider implements IdentityProvider<ApiKeyAuthenticationRequest> {

    public static final String SCOPES_ATTRIBUTE = "jackpoll.api-key.scopes";
    public static final String KEY_ID_ATTRIBUTE = "jackpoll.api-key.id";

    @Inject
    ApiKeyService apiKeys;

    @Override
    public Class<ApiKeyAuthenticationRequest> getRequestType() {
        return ApiKeyAuthenticationRequest.class;
    }

    @Override
    public Uni<SecurityIdentity> authenticate(ApiKeyAuthenticationRequest request, AuthenticationRequestContext context) {
        return context.runBlocking(() -> identityFor(request.secret()));
    }

    @ActivateRequestContext
    SecurityIdentity identityFor(String secret) {
        var key = apiKeys.authenticate(secret).orElseThrow(AuthenticationFailedException::new);
        return QuarkusSecurityIdentity.builder()
            .setPrincipal(new QuarkusPrincipal(key.userId))
            .addAttribute(SCOPES_ATTRIBUTE, Set.copyOf(ApiKeyService.scopesOf(key)))
            .addAttribute(KEY_ID_ATTRIBUTE, key.id)
            .build();
    }
}
