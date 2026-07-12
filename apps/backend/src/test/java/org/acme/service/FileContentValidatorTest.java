package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

/** Magic-byte content sniffing for uploads (issue #43). */
class FileContentValidatorTest {

    @Test
    void detectsSupportedImageFormats() {
        assertEquals("image/jpeg", FileContentValidator.sniffImageType(
            new byte[] { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0 }));
        assertEquals("image/png", FileContentValidator.sniffImageType(
            new byte[] { (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A }));
        assertEquals("image/gif", FileContentValidator.sniffImageType(
            new byte[] { 'G', 'I', 'F', '8', '9', 'a', 0 }));
        assertEquals("image/webp", FileContentValidator.sniffImageType(
            new byte[] { 'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P' }));
    }

    @Test
    void rejectsNonImageAndSpoofedContent() {
        assertNull(FileContentValidator.sniffImageType("hello world".getBytes()));
        assertNull(FileContentValidator.sniffImageType(new byte[] { 0x4D, 0x5A })); // MZ (exe)
        assertNull(FileContentValidator.sniffImageType(new byte[0]));
        assertNull(FileContentValidator.sniffImageType(null));
    }
}
