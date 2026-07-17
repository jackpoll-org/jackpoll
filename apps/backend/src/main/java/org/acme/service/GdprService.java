package org.acme.service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import org.acme.exception.ResourceNotFoundException;
import org.acme.mapper.SurveyMapper;
import org.acme.repository.AccessCodeRepository;
import org.acme.repository.AnalyticsRepository;
import org.acme.repository.CollabLinkRepository;
import org.acme.repository.CollaboratorRepository;
import org.acme.repository.DeviceTokenRepository;
import org.acme.repository.FolderRepository;
import org.acme.repository.ResponseDraftRepository;
import org.acme.repository.ShareLinkRepository;
import org.acme.repository.SurveyRepository;
import org.acme.repository.TemplateRepository;
import org.acme.repository.UserRepository;
import org.acme.repository.WebhookRepository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/**
 * GDPR data-subject rights (Art. 15/17/20): export all of a user's data in a
 * structured, machine-readable form, and erase the account across every table
 * plus Keycloak.
 */
@ApplicationScoped
public class GdprService {

    @Inject UserRepository users;
    @Inject SurveyRepository surveys;
    @Inject SurveyMapper surveyMapper;
    @Inject ResponseService responseService;
    @Inject SurveyService surveyService;
    @Inject KeycloakService keycloak;
    @Inject ResponseDraftRepository drafts;
    @Inject AnalyticsRepository analytics;
    @Inject ShareLinkRepository shareLinks;
    @Inject AccessCodeRepository accessCodes;
    @Inject CollabLinkRepository collabLinks;
    @Inject WebhookRepository webhooks;
    @Inject CollaboratorRepository collaborators;
    @Inject DeviceTokenRepository devices;
    @Inject FolderRepository folders;
    @Inject TemplateRepository templates;

    // ── Export (Art. 15 / 20) ─────────────────────────────────────

    /** A structured snapshot of everything we hold about the user. */
    public Map<String, Object> export(String userId) {
        var user = users.findByIdOptional(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        var owned = surveys.list("ownerId", userId);
        var surveyExports = owned.stream().map(s -> {
            var entry = new LinkedHashMap<String, Object>();
            entry.put("survey", surveyMapper.toDto(s));
            // Responses to the user's own surveys are part of their data.
            entry.put("responses", responseService.list(userId, s.id, null, null, false));
            return entry;
        }).toList();

        var out = new LinkedHashMap<String, Object>();
        out.put("exportedAt", Instant.now().toString());
        out.put("user", Map.of(
            "id", user.id,
            "email", user.email,
            "name", user.name == null ? "" : user.name,
            "emailVerified", user.emailVerified,
            "createdAt", user.createdAt == null ? "" : user.createdAt.toString()));
        out.put("surveys", surveyExports);
        out.put("folders", folders.list("ownerId", userId));
        out.put("templates", templates.list("ownerId", userId));
        return out;
    }

    // ── Erasure (Art. 17) ─────────────────────────────────────────

    /**
     * Erase all of a user's content data (surveys, responses, files, folders,
     * templates, device tokens, memberships) while leaving the {@code users} row
     * and Keycloak identity untouched — the account keeps working. Shared by
     * {@link #deleteAccount} and the standalone "delete my data" flow.
     */
    @Transactional
    public void clearUserData(String userId) {
        if (users.findByIdOptional(userId).isEmpty()) {
            throw new ResourceNotFoundException("User not found");
        }

        for (var survey : surveys.list("ownerId", userId)) {
            var id = survey.id;
            responseService.clearResponses(userId, id); // responses + answers + counters
            drafts.delete("surveyId", id);
            analytics.delete("surveyId", id);
            shareLinks.delete("surveyId", id);
            accessCodes.delete("surveyId", id);
            collabLinks.delete("surveyId", id);
            webhooks.delete("surveyId", id);
            surveyService.delete(userId, id); // collaborators + survey (+ questions/options)
        }

        // Rows that reference the user directly.
        collaborators.delete("userId", userId); // memberships on others' surveys
        devices.delete("userId", userId);
        folders.delete("ownerId", userId);
        templates.delete("ownerId", userId);
    }

    /** Permanently delete the user and all of their data (best-effort, atomic). */
    @Transactional
    public void deleteAccount(String userId) {
        var user = users.findByIdOptional(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        clearUserData(userId);
        users.delete(user);

        // Erase at the identity provider last; a failure here rolls the tx back.
        keycloak.deleteUser(userId);
    }
}
