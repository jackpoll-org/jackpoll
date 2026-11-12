package org.acme.config;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import io.minio.MinioClient;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Singleton;

/** Produces a singleton {@link MinioClient} configured from {@code minio.*} properties. */
@ApplicationScoped
public class MinioConfig {

    @Produces
    @Singleton
    MinioClient minioClient(
        @ConfigProperty(name = "minio.url") String url,
        @ConfigProperty(name = "minio.access-key") String accessKey,
        @ConfigProperty(name = "minio.secret-key") String secretKey
    ) {
        MinioClient client = MinioClient.builder()
            .endpoint(url)
            .credentials(accessKey, secretKey)
            .build();
        client.setTimeout(5_000, 60_000, 60_000);
        return client;
    }
}
