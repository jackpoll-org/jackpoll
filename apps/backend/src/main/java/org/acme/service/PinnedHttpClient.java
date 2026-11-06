package org.acme.service;

import java.net.URI;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import io.vertx.core.Vertx;
import io.vertx.core.buffer.Buffer;
import io.vertx.core.http.HttpClient;
import io.vertx.core.http.HttpClientResponse;
import io.vertx.core.http.HttpMethod;
import io.vertx.core.http.RequestOptions;
import io.vertx.core.net.SocketAddress;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

/**
 * POSTs to a URL a user gave us (webhooks, Web Push endpoints). It connects to
 * the exact address {@link OutboundUrlGuard} approved, so a second DNS lookup
 * can't swap in an internal host; the URL's host still names the Host header
 * and the TLS certificate. Redirects are never followed.
 */
@ApplicationScoped
public class PinnedHttpClient {

    @Inject
    Vertx vertx;

    @Inject
    OutboundUrlGuard urlGuard;

    private volatile HttpClient http;

    private HttpClient http() {
        if (http == null) {
            synchronized (this) {
                if (http == null) http = vertx.createHttpClient();
            }
        }
        return http;
    }

    /** @return the response status; throws when the URL is refused, unreachable or too slow. */
    public int post(String url, Map<String, String> headers, byte[] body, long timeoutSeconds) throws Exception {
        var address = urlGuard.resolveAllowed(url);
        var uri = URI.create(url);
        int port = uri.getPort() != -1 ? uri.getPort() : "https".equals(uri.getScheme()) ? 443 : 80;
        var options = new RequestOptions()
            .setMethod(HttpMethod.POST)
            .setAbsoluteURI(url)
            .setServer(SocketAddress.inetSocketAddress(port, address.getHostAddress()))
            .setFollowRedirects(false)
            .setConnectTimeout(5_000)
            .setTimeout(TimeUnit.SECONDS.toMillis(timeoutSeconds));
        headers.forEach(options::putHeader);
        return http().request(options)
            .compose(request -> request.send(Buffer.buffer(body)))
            .map(HttpClientResponse::statusCode)
            .toCompletionStage().toCompletableFuture()
            .get(timeoutSeconds + 5, TimeUnit.SECONDS);
    }
}
