package org.acme.dto;

import java.time.Instant;
import java.util.List;

import org.acme.dto.ResponseDtos.AnswerDto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

/** DTOs for save &amp; resume drafts (issue #26). */
public final class DraftDtos {

    private DraftDtos() {}

    /** Create or update a draft. {@code token} is null on first save.
     *  Bounds guard this anonymous, public write path (see SubmitResponseRequest). */
    public record SaveDraftRequest(
        @Size(max = 256) String token,
        @Size(max = 1000) List<@Valid AnswerDto> answers,
        Integer position
    ) {}

    /** A restored draft returned to the resuming respondent. */
    public record DraftDto(
        String token,
        String surveyId,
        Object answers,
        Integer position,
        Instant expiresAt
    ) {}
}
