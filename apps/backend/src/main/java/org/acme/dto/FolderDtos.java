package org.acme.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class FolderDtos {

    private FolderDtos() {}

    public record FolderRequest(@NotBlank @Size(max = 120) String name) {}

    public record FolderDto(String id, String name) {}
}
