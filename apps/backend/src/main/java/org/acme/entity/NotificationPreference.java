package org.acme.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

/**
 * A single (event, channel) override for one user. A missing row means
 * "enabled" — this table only stores exceptions to the all-on default (#89).
 */
@Entity
@Table(name = "notification_preferences")
@IdClass(NotificationPreferenceId.class)
public class NotificationPreference extends PanacheEntityBase {

    @Id
    @Column(name = "user_id", length = 36)
    public String userId;

    @Id
    @Column(name = "event_type", length = 40)
    public String eventType;

    @Id
    @Column(length = 16)
    public String channel;

    @Column(nullable = false)
    public boolean enabled;
}
