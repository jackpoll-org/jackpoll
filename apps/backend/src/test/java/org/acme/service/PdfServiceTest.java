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

    @Test
    void neverFetchesRemoteResources() throws Exception {
        try (var server = new java.net.ServerSocket(0)) {
            new PdfService().render(
                "<html><head><style>body{background:url(http://127.0.0.1:" + server.getLocalPort()
                + "/probe)}</style></head><body><img src=\"http://127.0.0.1:" + server.getLocalPort()
                + "/img.png\"/></body></html>");
            server.setSoTimeout(300);
            org.junit.jupiter.api.Assertions.assertThrows(
                java.net.SocketTimeoutException.class, server::accept);
        }
    }
}
