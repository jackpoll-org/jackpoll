package org.acme.service;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;

import org.acme.exception.InvalidUploadException;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import jakarta.enterprise.context.ApplicationScoped;

/**
 * Optional antivirus scanning of uploaded files via clamd's INSTREAM protocol
 * (issue #43). Disabled by default; enable with {@code survey.upload.clamav.*}
 * and run a clamd sidecar. When enabled and clamd is unreachable the upload is
 * rejected (fail-closed) unless {@code fail-open} is set.
 */
@ApplicationScoped
public class ClamAvScanner {

    private static final Logger LOG = Logger.getLogger(ClamAvScanner.class);
    private static final int CHUNK = 2048;

    @ConfigProperty(name = "survey.upload.clamav.enabled", defaultValue = "false")
    boolean enabled;

    @ConfigProperty(name = "survey.upload.clamav.host", defaultValue = "localhost")
    String host;

    @ConfigProperty(name = "survey.upload.clamav.port", defaultValue = "3310")
    int port;

    @ConfigProperty(name = "survey.upload.clamav.fail-open", defaultValue = "false")
    boolean failOpen;

    /**
     * Scan the given bytes. No-op when disabled. Throws
     * {@link InvalidUploadException} if a threat is found, or if clamd is
     * unreachable and {@code fail-open} is false.
     */
    public void scan(byte[] data) {
        if (!enabled) return;

        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), 5000);
            socket.setSoTimeout(20000);
            String response = streamAndRead(socket, data);

            // clamd replies "stream: OK" or "stream: <Threat> FOUND".
            if (response.contains("FOUND")) {
                String threat = response.replace("stream:", "").replace("FOUND", "").trim();
                throw new InvalidUploadException(
                    "File rejected: it failed a malware scan (" + threat + ").");
            }
        } catch (InvalidUploadException e) {
            throw e;
        } catch (IOException e) {
            if (failOpen) {
                LOG.warnf(e, "clamd unreachable at %s:%d; accepting upload (fail-open)", host, port);
                return;
            }
            LOG.errorf(e, "clamd unreachable at %s:%d; rejecting upload (fail-closed)", host, port);
            throw new InvalidUploadException(
                "File could not be virus-scanned right now. Please try again later.");
        }
    }

    private String streamAndRead(Socket socket, byte[] data) throws IOException {
        OutputStream out = socket.getOutputStream();
        out.write("zINSTREAM\0".getBytes(StandardCharsets.US_ASCII));
        for (int offset = 0; offset < data.length; offset += CHUNK) {
            int len = Math.min(CHUNK, data.length - offset);
            out.write(ByteBuffer.allocate(4).putInt(len).array());
            out.write(data, offset, len);
        }
        // Zero-length chunk terminates the stream.
        out.write(new byte[] { 0, 0, 0, 0 });
        out.flush();

        InputStream in = socket.getInputStream();
        return new String(in.readAllBytes(), StandardCharsets.US_ASCII).trim();
    }
}
