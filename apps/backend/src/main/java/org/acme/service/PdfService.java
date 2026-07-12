package org.acme.service;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import jakarta.enterprise.context.ApplicationScoped;

import java.io.ByteArrayOutputStream;

/** Renders XHTML/CSS into a PDF byte array (issue #84). */
@ApplicationScoped
public class PdfService {

    public byte[] render(String xhtml) {
        try (var out = new ByteArrayOutputStream()) {
            var builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(xhtml, null);
            builder.toStream(out);
            builder.run();
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Failed to render PDF", e);
        }
    }
}
