package org.acme.repository;

import java.util.List;
import java.util.Optional;

import org.acme.entity.DeviceToken;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class DeviceTokenRepository implements PanacheRepositoryBase<DeviceToken, String> {

    public Optional<DeviceToken> findByToken(String token) {
        return find("token", token).firstResultOptional();
    }

    public List<DeviceToken> findByUser(String userId) {
        return list("userId", userId);
    }
}
