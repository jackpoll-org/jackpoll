package org.acme.config;

import java.sql.SQLException;

import org.flywaydb.core.api.configuration.FluentConfiguration;

import io.quarkus.flyway.FlywayConfigurationCustomizer;
import jakarta.enterprise.context.ApplicationScoped;

/**
 * Keycloak shares the database, so a fresh install can already contain its
 * tables when the backend first migrates. Flyway then sees a non-empty schema
 * and would baseline it at V1, skipping the V1 script that creates the app
 * tables. Baseline at V0 instead while no app table exists, so V1 still runs;
 * databases that predate Flyway keep the V1 baseline.
 */
@ApplicationScoped
public class FlywayBaselineCustomizer implements FlywayConfigurationCustomizer {

    @Override
    public void customize(FluentConfiguration configuration) {
        try (var connection = configuration.getDataSource().getConnection();
             var result = connection.createStatement().executeQuery(
                 "SELECT to_regclass('public.surveys') IS NULL")) {
            if (result.next() && result.getBoolean(1)) {
                configuration.baselineVersion("0");
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Could not inspect the database before migrating", e);
        }
    }
}
