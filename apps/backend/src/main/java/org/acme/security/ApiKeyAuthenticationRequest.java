package org.acme.security;

import io.quarkus.security.identity.request.BaseAuthenticationRequest;

public class ApiKeyAuthenticationRequest extends BaseAuthenticationRequest {

    private final String secret;

    public ApiKeyAuthenticationRequest(String secret) {
        this.secret = secret;
    }

    public String secret() {
        return secret;
    }
}
