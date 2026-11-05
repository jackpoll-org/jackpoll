package org.acme.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.acme.dto.ApiKeyDtos.ApiKeyDto;
import org.acme.dto.ApiKeyDtos.CreatedApiKeyDto;
import org.acme.entity.ApiKey;
import org.acme.exception.ResourceNotFoundException;
import org.acme.repository.ApiKeyRepository;
import org.acme.repository.UserRepository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

@ApplicationScoped
public class ApiKeyService {

    public static final String KEY_PREFIX = "jp_";
    public static final String SCOPE_SURVEYS = "surveys";
    public static final String SCOPE_RESPONSES = "responses";

    static final int MAX_KEYS_PER_USER = 20;
    private static final int SECRET_BYTES = 32;
    private static final int DISPLAY_PREFIX_LENGTH = 11;
    private static final Duration LAST_USED_GRANULARITY = Duration.ofMinutes(5);
    private static final SecureRandom RANDOM = new SecureRandom();

    @Inject
    ApiKeyRepository keys;

    @Inject
    UserRepository users;

    public List<ApiKeyDto> list(String userId) {
        return keys.findByUser(userId).stream().map(ApiKeyService::toDto).toList();
    }

    @Transactional
    public CreatedApiKeyDto create(String userId, String name, boolean readResponses) {
        if (keys.countByUser(userId) >= MAX_KEYS_PER_USER) {
            throw new IllegalArgumentException("You can have at most " + MAX_KEYS_PER_USER + " API keys.");
        }
        var bytes = new byte[SECRET_BYTES];
        RANDOM.nextBytes(bytes);
        var secret = KEY_PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        var scopes = new ArrayList<String>(List.of(SCOPE_SURVEYS));
        if (readResponses) scopes.add(SCOPE_RESPONSES);

        var key = new ApiKey();
        key.id = UUID.randomUUID().toString();
        key.userId = userId;
        key.name = name.strip();
        key.prefix = secret.substring(0, DISPLAY_PREFIX_LENGTH);
        key.keyHash = hash(secret);
        key.scopes = String.join(",", scopes);
        key.createdAt = Instant.now();
        keys.persist(key);
        return new CreatedApiKeyDto(toDto(key), secret);
    }

    @Transactional
    public void delete(String userId, String keyId) {
        var key = keys.findByIdOptional(keyId)
            .filter(k -> k.userId.equals(userId))
            .orElseThrow(() -> new ResourceNotFoundException("API key not found."));
        keys.delete(key);
    }

    @Transactional
    public void deleteAllForUser(String userId) {
        keys.delete("userId", userId);
    }

    @Transactional
    public Optional<ApiKey> authenticate(String secret) {
        if (secret == null || !secret.startsWith(KEY_PREFIX)) return Optional.empty();
        var key = keys.findByHash(hash(secret)).filter(k -> users.findByIdOptional(k.userId).isPresent());
        key.ifPresent(k -> {
            var now = Instant.now();
            if (k.lastUsedAt == null || k.lastUsedAt.isBefore(now.minus(LAST_USED_GRANULARITY))) {
                k.lastUsedAt = now;
            }
        });
        return key;
    }

    public static List<String> scopesOf(ApiKey key) {
        return List.of(key.scopes.split(","));
    }

    private static ApiKeyDto toDto(ApiKey k) {
        return new ApiKeyDto(
            k.id,
            k.name,
            k.prefix,
            scopesOf(k),
            k.createdAt.toString(),
            k.lastUsedAt != null ? k.lastUsedAt.toString() : null);
    }

    private static String hash(String secret) {
        try {
            var digest = MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
