package org.acme.security;

import java.util.Map;
import java.util.Set;

import org.acme.dto.ApiResponse;
import org.acme.exception.RateLimitedException;
import org.acme.resource.FolderResource;
import org.acme.resource.ResponseResource;
import org.acme.resource.ShareLinkResource;
import org.acme.resource.SurveyResource;
import org.acme.service.ApiKeyService;
import org.acme.service.RateLimiterService;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.ws.rs.HttpMethod;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ResourceInfo;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;

@Provider
public class ApiKeyScopeFilter implements ContainerRequestFilter {

    private static final int REQUESTS_PER_MINUTE = 300;

    private static final Map<Class<?>, String> SCOPE_BY_RESOURCE = Map.of(
        SurveyResource.class, ApiKeyService.SCOPE_SURVEYS,
        FolderResource.class, ApiKeyService.SCOPE_SURVEYS,
        ShareLinkResource.class, ApiKeyService.SCOPE_SURVEYS,
        ResponseResource.class, ApiKeyService.SCOPE_RESPONSES);

    @Inject
    SecurityIdentity identity;

    @Inject
    RateLimiterService rateLimiter;

    @Context
    ResourceInfo resourceInfo;

    @Override
    public void filter(ContainerRequestContext request) {
        Set<String> scopes = identity.getAttribute(ApiKeyIdentityProvider.SCOPES_ATTRIBUTE);
        if (scopes == null) return;

        if (!rateLimiter.allow("api-key|" + identity.getAttribute(ApiKeyIdentityProvider.KEY_ID_ATTRIBUTE),
                REQUESTS_PER_MINUTE, 60)) {
            throw new RateLimitedException("Too many API requests. Please slow down.");
        }

        var method = resourceInfo.getResourceMethod();
        var scope = SCOPE_BY_RESOURCE.get(resourceInfo.getResourceClass());
        boolean allowed = method != null && scope != null
            && (method.isAnnotationPresent(PermitAll.class)
                || scopes.contains(scope)
                    && (!ApiKeyService.SCOPE_RESPONSES.equals(scope) || HttpMethod.GET.equals(request.getMethod())));
        if (!allowed) {
            request.abortWith(Response.status(Response.Status.FORBIDDEN)
                .entity(ApiResponse.error("This API key can't access this endpoint."))
                .build());
        }
    }
}
