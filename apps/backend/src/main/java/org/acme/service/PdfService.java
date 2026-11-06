package org.acme.service;

import com.openhtmltopdf.extend.FSStream;
import com.openhtmltopdf.extend.FSStreamFactory;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import jakarta.enterprise.context.ApplicationScoped;

import java.io.ByteArrayOutputStream;

/** Renders XHTML/CSS into a PDF byte array (issue #84). */
@ApplicationScoped
public class PdfService {

    /** The rendered HTML holds user-written text, so it must never make the server fetch a URL. */
    private static final FSStreamFactory NO_REMOTE_RESOURCES = url -> new FSStream() {
        @Override
        public java.io.InputStream getStream() {
            return null;
        }

        @Override
        public java.io.Reader getReader() {
            return null;
        }
    };

    public byte[] render(String xhtml) {
        try (var out = new ByteArrayOutputStream()) {
            var builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.useProtocolsStreamImplementation(NO_REMOTE_RESOURCES, "http", "https", "file", "ftp", "jar");
            builder.withHtmlContent(xhtml, null);
            builder.toStream(out);
            builder.run();
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Failed to render PDF", e);
        }
    }
}
