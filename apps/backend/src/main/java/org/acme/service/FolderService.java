package org.acme.service;

import java.util.List;
import java.util.UUID;

import org.acme.dto.FolderDtos.FolderDto;
import org.acme.dto.FolderDtos.FolderRequest;
import org.acme.entity.Folder;
import org.acme.exception.ResourceNotFoundException;
import org.acme.repository.FolderRepository;
import org.acme.repository.SurveyRepository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/** Owner-scoped survey folders (issue #33). */
@ApplicationScoped
public class FolderService {

    @Inject
    FolderRepository folders;

    @Inject
    SurveyRepository surveys;

    public List<FolderDto> list(String ownerId) {
        return folders.findByOwner(ownerId).stream().map(this::toDto).toList();
    }

    @Transactional
    public FolderDto create(String ownerId, FolderRequest req) {
        var folder = new Folder();
        folder.id = UUID.randomUUID().toString();
        folder.ownerId = ownerId;
        folder.name = req.name();
        folders.persist(folder);
        return toDto(folder);
    }

    @Transactional
    public FolderDto rename(String ownerId, String id, FolderRequest req) {
        var folder = findOwnedOrThrow(ownerId, id);
        folder.name = req.name();
        return toDto(folder);
    }

    @Transactional
    public void delete(String ownerId, String id) {
        var folder = findOwnedOrThrow(ownerId, id);
        // Surveys in the folder become unfiled rather than dangling.
        surveys.update("folderId = null where folderId = ?1", id);
        folders.delete(folder);
    }

    private Folder findOwnedOrThrow(String ownerId, String id) {
        return folders.findByIdAndOwner(id, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Folder not found: " + id));
    }

    private FolderDto toDto(Folder f) {
        return new FolderDto(f.id, f.name);
    }
}
