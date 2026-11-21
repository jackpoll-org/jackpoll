package org.acme.exception;

import java.util.List;

import org.acme.dto.RunDtos.PublicRunDto;

public class RunException extends RuntimeException {

    public final int status;
    public final String code;
    public final List<PublicRunDto> runs;
    public final String nextOpensAt;

    public RunException(int status, String code, String message, List<PublicRunDto> runs, String nextOpensAt) {
        super(message);
        this.status = status;
        this.code = code;
        this.runs = runs;
        this.nextOpensAt = nextOpensAt;
    }

    public static RunException conflict(String code, String message) {
        return new RunException(409, code, message, null, null);
    }
}
