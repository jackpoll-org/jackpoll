package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.acme.dto.SurveyDtos.CreateSurveyRequest;
import org.acme.dto.SurveyDtos.OptionDto;
import org.acme.dto.SurveyDtos.QuestionDto;
import org.acme.dto.SurveyDtos.UpdateSurveyRequest;
import org.acme.entity.CollaboratorRole;
import org.acme.entity.OptionKind;
import org.acme.entity.QuestionType;
import org.acme.entity.Survey;
import org.acme.entity.SurveyCollaborator;
import org.acme.entity.SurveyStatus;
import org.acme.exception.ForbiddenAccessException;
import org.acme.exception.ResourceNotFoundException;
import org.acme.mapper.SurveyMapper;
import org.acme.repository.CollaboratorRepository;
import org.acme.repository.SurveyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Pure unit tests for {@link SurveyService} using mocked repositories and a real
 * mapper — no Quarkus boot or database required.
 */
class SurveyServiceTest {

    private static final String OWNER = "owner-1";
    private static final String OTHER = "owner-2";

    private SurveyRepository repository;
    private CollaboratorRepository collaborators;
    private SurveyService service;

    @BeforeEach
    void setUp() {
        repository = mock(SurveyRepository.class);
        collaborators = mock(CollaboratorRepository.class);
        service = new SurveyService();
        service.repository = repository;
        service.collaborators = collaborators;
        service.mapper = new SurveyMapper();
        // default: no collaborator rows
        when(collaborators.findBySurveyAndUser(anyString(), anyString())).thenReturn(Optional.empty());
    }

    private Survey survey(String id, String ownerId) {
        var s = new Survey();
        s.id = id;
        s.ownerId = ownerId;
        s.title = "Original";
        s.status = SurveyStatus.DRAFT;
        s.updatedAt = Instant.now();
        return s;
    }

    private SurveyCollaborator collab(String surveyId, String userId, CollaboratorRole role) {
        var c = new SurveyCollaborator();
        c.surveyId = surveyId;
        c.userId = userId;
        c.role = role;
        // These fixtures represent active collaborators (invitation accepted, #8).
        c.status = org.acme.entity.CollaboratorStatus.ACCEPTED;
        return c;
    }

    @Test
    void create_persistsSurveyWithOwnerAndDraftStatus() {
        var dto = service.create(OWNER, new CreateSurveyRequest("My Survey", "desc"));

        assertNotNull(dto.id());
        assertEquals(OWNER, dto.ownerId());
        assertEquals(SurveyStatus.DRAFT, dto.status());
        verify(repository).persist(any(Survey.class));
    }

    @Test
    void get_returnsOwnedSurvey() {
        when(repository.findByIdOptional("s1")).thenReturn(Optional.of(survey("s1", OWNER)));
        assertEquals("s1", service.get(OWNER, "s1").id());
    }

    @Test
    void get_allowsCollaborator() {
        when(repository.findByIdOptional("s1")).thenReturn(Optional.of(survey("s1", OWNER)));
        when(collaborators.findBySurveyAndUser("s1", OTHER))
            .thenReturn(Optional.of(collab("s1", OTHER, CollaboratorRole.VIEWER)));
        assertEquals("s1", service.get(OTHER, "s1").id());
    }

    @Test
    void get_throwsWhenNoAccess() {
        when(repository.findByIdOptional("s1")).thenReturn(Optional.of(survey("s1", OWNER)));
        assertThrows(ResourceNotFoundException.class, () -> service.get(OTHER, "s1"));
    }

    @Test
    void update_allowsOwnerAndRebuildsQuestions() {
        when(repository.findByIdOptional("s1")).thenReturn(Optional.of(survey("s1", OWNER)));

        var grid = new QuestionDto(
            null, QuestionType.MULTIPLE_CHOICE_GRID, "Grid?", null, true, 0,
            null,
            List.of(new OptionDto(null, "Row 1", null, null), new OptionDto(null, "Row 2", null, null)),
            List.of(new OptionDto(null, "Col 1", null, null)),
            null, null, null, null, null, null);
        var req = new UpdateSurveyRequest("Updated", "d", SurveyStatus.PUBLISHED, null, List.of(grid), null, null, null, null);

        var dto = service.update(OWNER, "s1", req);

        assertEquals("Updated", dto.title());
        assertEquals(2, dto.questions().get(0).rows().size());
        assertTrue(dto.questions().get(0).columns().size() == 1);
    }

    @Test
    void update_allowsEditorCollaborator() {
        when(repository.findByIdOptional("s1")).thenReturn(Optional.of(survey("s1", OWNER)));
        when(collaborators.findBySurveyAndUser("s1", OTHER))
            .thenReturn(Optional.of(collab("s1", OTHER, CollaboratorRole.EDITOR)));

        var req = new UpdateSurveyRequest("Edited", null, SurveyStatus.DRAFT, null, null, null, null, null, null);
        assertEquals("Edited", service.update(OTHER, "s1", req).title());
    }

    @Test
    void update_forbidsViewerCollaborator() {
        when(repository.findByIdOptional("s1")).thenReturn(Optional.of(survey("s1", OWNER)));
        when(collaborators.findBySurveyAndUser("s1", OTHER))
            .thenReturn(Optional.of(collab("s1", OTHER, CollaboratorRole.VIEWER)));

        var req = new UpdateSurveyRequest("x", null, SurveyStatus.DRAFT, null, null, null, null, null, null);
        assertThrows(ForbiddenAccessException.class, () -> service.update(OTHER, "s1", req));
    }

    @Test
    void delete_removesOwnedSurveyAndCollaborators() {
        var survey = survey("s1", OWNER);
        when(repository.findByIdAndOwner("s1", OWNER)).thenReturn(Optional.of(survey));

        service.delete(OWNER, "s1");

        verify(collaborators).delete(eq("surveyId"), eq("s1"));
        verify(repository).delete(survey);
    }

    @Test
    void delete_throwsAndDoesNotDeleteWhenNotOwned() {
        when(repository.findByIdAndOwner("s1", OTHER)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> service.delete(OTHER, "s1"));
        verify(repository, never()).delete(any());
    }

    @Test
    void reorder_assignsSequentialPositionsToOwnedSurveysInBucket() {
        var s1 = survey("s1", OWNER);
        var s2 = survey("s2", OWNER);
        when(repository.findByIdAndOwner("s1", OWNER)).thenReturn(Optional.of(s1));
        when(repository.findByIdAndOwner("s2", OWNER)).thenReturn(Optional.of(s2));

        service.reorder(OWNER, new org.acme.dto.SurveyDtos.ReorderRequest(null, List.of("s2", "s1")));

        assertEquals(0.0, s2.sortPosition);
        assertEquals(1.0, s1.sortPosition);
    }

    @Test
    void reorder_ignoresIdsInADifferentFolder() {
        var s1 = survey("s1", OWNER);
        s1.folderId = "f1"; // request targets root (null) → must be skipped
        when(repository.findByIdAndOwner("s1", OWNER)).thenReturn(Optional.of(s1));

        service.reorder(OWNER, new org.acme.dto.SurveyDtos.ReorderRequest(null, List.of("s1")));

        org.junit.jupiter.api.Assertions.assertNull(s1.sortPosition);
    }

    @Test
    void organize_movingFolderDropsSurveyToEndOfDestination() {
        var moved = survey("s1", OWNER); // currently root (folderId null)
        when(repository.findByIdOptional("s1")).thenReturn(Optional.of(moved));
        var existing = survey("s2", OWNER);
        existing.folderId = "f1";
        existing.sortPosition = 4.0;
        when(repository.list("ownerId = ?1 and folderId = ?2", OWNER, "f1"))
            .thenReturn(List.of(existing));

        service.organize(OWNER, "s1",
            new org.acme.dto.SurveyDtos.OrganizeRequest(List.of(), "f1"));

        assertEquals("f1", moved.folderId);
        assertEquals(5.0, moved.sortPosition); // max(4)+1
    }

    @Test
    void list_includesOwnedAndCollaboratedSurveys() {
        when(repository.list("ownerId", OWNER)).thenReturn(List.of(survey("s1", OWNER)));
        when(collaborators.findAcceptedByUser(OWNER))
            .thenReturn(List.of(collab("s2", OWNER, CollaboratorRole.EDITOR)));
        when(repository.list("id in ?1", List.of("s2")))
            .thenReturn(List.of(survey("s2", OTHER)));

        var result = service.list(OWNER, 0, 20);

        assertEquals(2, result.size());
        assertEquals(2, service.count(OWNER));
    }
}
