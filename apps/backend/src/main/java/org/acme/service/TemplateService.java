package org.acme.service;

import java.util.List;
import java.util.UUID;

import org.acme.dto.TemplateDtos.CreateTemplateRequest;
import org.acme.dto.TemplateDtos.TemplateDto;
import org.acme.dto.TemplateDtos.UpdateTemplateRequest;
import org.acme.entity.Template;
import org.acme.exception.QuotaExceededException;
import org.acme.exception.ResourceNotFoundException;
import org.acme.repository.TemplateRepository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/** CRUD for user-saved survey templates, scoped to the owner (issue #20). */
@ApplicationScoped
public class TemplateService {

    static final int MAX_TEMPLATES_PER_USER = 100;
    static final int MAX_TEMPLATE_BYTES = 1_048_576;

    @Inject
    TemplateRepository repository;

    @Inject
    ObjectMapper objectMapper;

    public List<TemplateDto> list(String ownerId) {
        return repository.findByOwner(ownerId).stream().map(this::toDto).toList();
    }

    @Transactional
    public TemplateDto create(String ownerId, CreateTemplateRequest req) {
        if (repository.countByOwner(ownerId) >= MAX_TEMPLATES_PER_USER) {
            throw new QuotaExceededException("You can save at most " + MAX_TEMPLATES_PER_USER + " templates.");
        }
        try {
            if (objectMapper.writeValueAsBytes(req).length > MAX_TEMPLATE_BYTES) {
                throw new IllegalArgumentException("This template is too large.");
            }
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Invalid template.");
        }
        var template = new Template();
        template.id = UUID.randomUUID().toString();
        template.ownerId = ownerId;
        template.name = req.name();
        template.description = req.description();
        template.questions = req.questions();
        template.settings = req.settings();
        template.sections = req.sections();
        repository.persist(template);
        return toDto(template);
    }

    @Transactional
    public TemplateDto update(String ownerId, String id, UpdateTemplateRequest req) {
        var template = findOwnedOrThrow(ownerId, id);
        template.name = req.name();
        template.description = req.description();
        return toDto(template);
    }

    @Transactional
    public void delete(String ownerId, String id) {
        repository.delete(findOwnedOrThrow(ownerId, id));
    }

    private Template findOwnedOrThrow(String ownerId, String id) {
        return repository.findByIdAndOwner(id, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Template not found: " + id));
    }

    private TemplateDto toDto(Template t) {
        return new TemplateDto(
            t.id,
            t.name,
            t.description,
            t.questions,
            t.settings,
            t.sections,
            t.updatedAt != null ? t.updatedAt.toString() : null);
    }
}
