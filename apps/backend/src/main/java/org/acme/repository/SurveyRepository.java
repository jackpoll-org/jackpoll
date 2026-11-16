package org.acme.repository;

import java.util.List;
import java.util.Optional;

import org.acme.entity.Question;
import org.acme.entity.Section;
import org.acme.entity.Survey;
import org.acme.entity.SurveySettings;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Page;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class SurveyRepository implements PanacheRepositoryBase<Survey, String> {

    public List<Survey> findByOwner(String ownerId, int page, int limit) {
        return find("ownerId", Sort.by("updatedAt").descending(), ownerId)
            .page(Page.of(page, limit))
            .list();
    }

    public long countByOwner(String ownerId) {
        return count("ownerId", ownerId);
    }

    public Optional<Survey> findByIdAndOwner(String id, String ownerId) {
        return find("id = ?1 and ownerId = ?2", id, ownerId).firstResultOptional();
    }

    @SuppressWarnings("unchecked")
    public Optional<Survey> findPageLayout(String id) {
        var em = getEntityManager();
        var head = em.createQuery("select s.settings, s.sections from Survey s where s.id = ?1", Object[].class)
            .setParameter(1, id)
            .getResultStream()
            .findFirst();
        if (head.isEmpty()) return Optional.empty();
        var layout = new Survey();
        layout.settings = (SurveySettings) head.get()[0];
        layout.sections = (List<Section>) head.get()[1];
        layout.questions = em.createQuery(
                "select q.id, q.sectionId from Question q where q.survey.id = ?1 order by q.order", Object[].class)
            .setParameter(1, id)
            .getResultStream()
            .map(row -> {
                var q = new Question();
                q.id = (String) row[0];
                q.sectionId = (String) row[1];
                return q;
            })
            .toList();
        return Optional.of(layout);
    }
}
