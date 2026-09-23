package org.acme.mail;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** The branded mail layout: escaping, and HTML/text parity. */
class EmailLayoutTest {

    private EmailLayout.Builder layout() {
        return EmailLayout.builder().appUrl("https://app.example.com");
    }

    @Test
    @DisplayName("user content is escaped into the HTML part")
    void escapesUserContent() {
        var mail = layout()
            .heading("Survey <script>alert(1)</script>")
            .paragraph("Owner \"O'Brien\" & co")
            .build();

        assertFalse(mail.html().contains("<script>"), "no raw markup from user content");
        assertTrue(mail.html().contains("&lt;script&gt;"));
        assertTrue(mail.html().contains("&quot;O&#39;Brien&quot; &amp; co"));
        // The text part is not markup, so it keeps the original characters.
        assertTrue(mail.text().contains("Owner \"O'Brien\" & co"));
    }

    @Test
    @DisplayName("every link survives in the plain-text part")
    void textPartKeepsLinks() {
        var mail = layout()
            .button("Open results", "https://app.example.com/surveys/1/results")
            .footerLink("Unsubscribe", "https://app.example.com/u/1")
            .build();

        assertTrue(mail.text().contains("Open results: "
            + "https://app.example.com/surveys/1/results"));
        assertTrue(mail.text().contains("Unsubscribe: https://app.example.com/u/1"));
        assertTrue(mail.html().contains("href=\"https://app.example.com/surveys/1/results\""));
    }

    @Test
    @DisplayName("blank and null blocks are dropped instead of rendering empty")
    void skipsEmptyBlocks() {
        var mail = layout()
            .heading("Title")
            .paragraph(null)
            .muted("  ")
            .bullets(List.of())
            .button("Go", null)
            .build();

        assertFalse(mail.html().contains("<p style"), "no empty paragraphs");
        assertFalse(mail.html().contains("<ul"), "no empty list");
        assertTrue(mail.text().startsWith("Title"));
    }

    /**
     * § 35a GmbHG wants the particulars on the letter itself. A link to an
     * imprint is what this footer had, and a link is one click away rather
     * than on the letter.
     */
    @Test
    @DisplayName("the Pflichtangaben are printed in both parts, not only linked")
    void carriesTheLegalFooterInBothParts() {
        var mail = layout()
            .footerLink("Impressum", "https://example.com/impressum")
            .legalFooter(
                "Beispiel UG (haftungsbeschränkt)",
                "Sitz: Musterstadt",
                "Registergericht: Amtsgericht Musterstadt · HRB 12345",
                "Geschäftsführer: Erika Mustermann")
            .heading("Hello")
            .build();

        for (String part : List.of(mail.html(), mail.text())) {
            assertTrue(part.contains("Beispiel UG (haftungsbeschränkt)"), part);
            assertTrue(part.contains("Sitz: Musterstadt"), part);
            assertTrue(part.contains("HRB 12345"), part);
            assertTrue(part.contains("Erika Mustermann"), part);
        }
        assertTrue(mail.html().contains("<br>"), "lines break in the HTML part");
    }

    /** A self-hosted install is somebody else's company; printing ours would be
     *  worse than printing none. */
    @Test
    @DisplayName("an install with no particulars configured prints none")
    void withoutParticularsPrintsNothing() {
        var mail = layout().legalFooter("", "  ", null).heading("Hello").build();

        assertFalse(mail.html().contains("HRB"), "nothing invented");
        assertTrue(mail.text().startsWith("Hello"));
    }

    @Test
    @DisplayName("the preheader is present but visually hidden")
    void rendersHiddenPreheader() {
        var mail = layout().preheader("Your code is 123456").heading("Verify").build();

        assertTrue(mail.html().contains("Your code is 123456"));
        assertTrue(mail.html().contains("display:none"));
    }
}
