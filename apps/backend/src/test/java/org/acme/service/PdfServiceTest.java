package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/** Plain unit test (no Quarkus boot) for the HTML→PDF renderer (#84). */
class PdfServiceTest {

    @Test
    void rendersValidPdfBytes() {
        var pdf = new PdfService();
        byte[] out = pdf.render(
            "<html><head><meta charset=\"utf-8\"/></head><body><h1>Hi</h1>"
            + "<p>Umlauts: äöü</p></body></html>");

        assertTrue(out.length > 0, "PDF should not be empty");
        // PDF files start with the "%PDF" magic header.
        assertEquals("%PDF", new String(out, 0, 4));
    }
}
