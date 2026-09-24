package org.acme.resource;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

/** Header-safe file names for downloaded uploads (public #6). */
class UploadAttachmentNameTest {

    @Test
    void keepsPlainNames() {
        assertEquals("attachment; filename=\"erm-diagram.png\"", UploadResource.attachment("erm-diagram.png"));
    }

    @Test
    void neutralisesQuotesAndHeaderBreaks() {
        assertEquals(
            "attachment; filename=\"a_b_.png__x_y\"",
            UploadResource.attachment("a\"b;.png\r\nx:y"));
    }

    @Test
    void fallsBackWhenNothingUsableIsLeft() {
        assertEquals("attachment; filename=\"upload\"", UploadResource.attachment(null));
        assertEquals("attachment; filename=\"upload\"", UploadResource.attachment("../"));
    }
}
