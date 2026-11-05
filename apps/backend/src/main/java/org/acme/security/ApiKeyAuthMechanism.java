package org.acme.security;

import java.util.Set;

import org.acme.service.ApiKeyService;

import io.quarkus.security.AuthenticationFailedException;
import io.quarkus.security.identity.IdentityProviderManager;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.security.identity.request.AuthenticationRequest;
import io.quarkus.vertx.http.runtime.security.ChallengeData;
import io.quarkus.vertx.http.runtime.security.HttpAuthenticationMechanism;
import io.quarkus.vertx.http.runtime.security.HttpSecurityUtils;
import io.smallrye.mutiny.Uni;
import io.vertx.ext.web.RoutingContext;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class ApiKeyAuthMechanism implements HttpAuthenticationMechanism {

    private static final String AUTHORIZATION = "Authorization";
    private static final String BEARER = "Bearer ";
    private static final String REST_PATH = "/api/v1/";

    @Override
    public Uni<SecurityIdentity> authenticate(RoutingContext context, IdentityProviderManager identityProviderManager) {
        var secret = apiKeyOf(context);
        if (secret == null) {
            return Uni.createFrom().nullItem();
        }
        if (!context.normalizedPath().startsWith(REST_PATH)) {
            return Uni.createFrom().failure(new AuthenticationFailedException());
        }
        var request = new ApiKeyAuthenticationRequest(secret);
        HttpSecurityUtils.setRoutingContextAttribute(request, context);
        return identityProviderManager.authenticate(request);
    }

    @Override
    public Uni<ChallengeData> getChallenge(RoutingContext context) {
        return apiKeyOf(context) != null
            ? Uni.createFrom().item(new ChallengeData(401, "WWW-Authenticate", "Bearer"))
            : Uni.createFrom().nullItem();
    }

    private static String apiKeyOf(RoutingContext context) {
        var header = context.request().getHeader(AUTHORIZATION);
        if (header == null || !header.regionMatches(true, 0, BEARER, 0, BEARER.length())) return null;
        var token = header.substring(BEARER.length()).strip();
        return token.startsWith(ApiKeyService.KEY_PREFIX) ? token : null;
    }

    @Override
    public Set<Class<? extends AuthenticationRequest>> getCredentialTypes() {
        return Set.of(ApiKeyAuthenticationRequest.class);
    }

    @Override
    public int getPriority() {
        return DEFAULT_PRIORITY + 1000;
    }
}
