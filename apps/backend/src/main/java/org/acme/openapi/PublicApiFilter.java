package org.acme.openapi;

import java.util.List;
import java.util.Map;

import org.eclipse.microprofile.openapi.OASFactory;
import org.eclipse.microprofile.openapi.OASFilter;
import org.eclipse.microprofile.openapi.models.OpenAPI;
import org.eclipse.microprofile.openapi.models.Paths;
import org.eclipse.microprofile.openapi.models.security.SecurityScheme;

public class PublicApiFilter implements OASFilter {

    private static final String REST_PATH = "/api/v1";
    private static final String PUBLIC_BASE = "/api";
    private static final String SCHEME = "apiKey";

    @Override
    public void filterOpenAPI(OpenAPI openAPI) {
        Paths rewritten = OASFactory.createPaths();
        if (openAPI.getPaths() != null && openAPI.getPaths().getPathItems() != null) {
            for (Map.Entry<String, org.eclipse.microprofile.openapi.models.PathItem> entry
                    : openAPI.getPaths().getPathItems().entrySet()) {
                var path = entry.getKey();
                rewritten.addPathItem(path.startsWith(REST_PATH) ? path.substring(REST_PATH.length()) : path,
                    entry.getValue());
            }
        }
        openAPI.setPaths(rewritten);
        openAPI.setServers(List.of(OASFactory.createServer().url(PUBLIC_BASE)));
        openAPI.setComponents(openAPI.getComponents() != null ? openAPI.getComponents() : OASFactory.createComponents());
        openAPI.getComponents().addSecurityScheme(SCHEME, OASFactory.createSecurityScheme()
            .type(SecurityScheme.Type.HTTP)
            .scheme("bearer")
            .description("A personal API key (jp_...) created under Settings > API keys."));
    }
}
