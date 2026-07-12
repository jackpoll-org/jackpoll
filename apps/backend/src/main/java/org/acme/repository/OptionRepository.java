package org.acme.repository;

import org.acme.entity.QuestionOption;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

/**
 * Data access for choice options, focused on the per-option quota counters
 * (issue #38). Reservations use a single conditional UPDATE so concurrent
 * submissions can never oversell a capacity — the row lock taken by the UPDATE
 * serialises the check-and-increment.
 */
@ApplicationScoped
public class OptionRepository implements PanacheRepositoryBase<QuestionOption, String> {

    /**
     * Atomically reserve one slot on a capped option.
     *
     * @return true if a slot was taken; false if the option is already full
     *         (or has no capacity, in which case nothing is reserved).
     */
    public boolean tryReserve(String optionId) {
        int updated = update(
            "used = used + 1 where id = ?1 and capacity is not null and used < capacity",
            optionId);
        return updated > 0;
    }

    /** Release one reserved slot (never below zero). Used on edit/delete. */
    public void release(String optionId) {
        update("used = used - 1 where id = ?1 and used > 0", optionId);
    }

    /** Reset all counters for a survey's options — used when clearing responses. */
    public void resetUsedForSurvey(String surveyId) {
        update("used = 0 where question.survey.id = ?1 and used <> 0", surveyId);
    }
}
