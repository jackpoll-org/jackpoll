package org.acme.repository;

import java.time.Instant;
import java.util.List;

import org.acme.entity.AuditEvent;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class AuditEventRepository implements PanacheRepositoryBase<AuditEvent, String> {

    public List<AuditEvent> findByActor(String actorId) {
        return list("actorId", Sort.by("createdAt").descending(), actorId);
    }

    public long deleteOlderThan(Instant cutoff) {
        return delete("createdAt < ?1", cutoff);
    }
}
