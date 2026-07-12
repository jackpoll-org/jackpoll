package org.acme.dto;

import org.acme.entity.CollaboratorRole;
import org.acme.entity.CollaboratorStatus;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public final class CollaboratorDtos {

    private CollaboratorDtos() {}

    public record AddCollaboratorRequest(
        @NotBlank @Email String email,
        @NotNull CollaboratorRole role
    ) {}

    public record CollaboratorDto(
        String userId,
        String email,
        String name,
        CollaboratorRole role,
        CollaboratorStatus status
    ) {}

    /** A pending invitation shown to the invitee in the app (#8). */
    public record InvitationDto(
        String surveyId,
        String surveyTitle,
        String ownerName,
        CollaboratorRole role
    ) {}
}
