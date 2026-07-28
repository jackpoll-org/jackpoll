package org.acme.mail;

import java.util.ArrayList;
import java.util.List;

/**
 * Renders transactional emails in the product's own visual language: the same
 * shadcn/ui design tokens the app and the landing use (brand blue {@code #024DB2}
 * with the {@code #4987D9} accent, white card on a muted page, 1px border,
 * 8px radius, Outfit-first font stack), translated into the subset of HTML that
 * email clients actually support — a table skeleton with fully inlined styles
 * and no external CSS, web fonts or images.
 *
 * <p>Every mail is built from the same small block vocabulary (heading,
 * paragraph, detail rows, button, note, divider) so no template can quietly
 * drift from the others, and each block renders <em>twice</em>: once as HTML and
 * once as plain text. Callers always send both parts, so clients with images or
 * HTML disabled still receive the full message — including every link, since a
 * button degrades to "Label: https://…" rather than disappearing.
 *
 * <p>All caller-supplied text is HTML-escaped here, so templates can pass survey
 * titles, display names and other user content straight through.
 */
public final class EmailLayout {

    // ── Design tokens (hex equivalents of the app/landing OKLCH tokens) ──
    private static final String BRAND = "#024DB2";        // --primary
    private static final String BRAND_ACCENT = "#4987D9"; // --brand-accent
    private static final String PAGE = "#f2f4f7";         // page behind the card
    private static final String CARD = "#ffffff";         // --card
    private static final String FOREGROUND = "#2b3240";   // --foreground
    private static final String MUTED = "#f7f8fa";        // --muted
    private static final String MUTED_FOREGROUND = "#6b7280"; // --muted-foreground
    private static final String BORDER = "#e4e7ec";       // --border
    private static final String FONT =
        "Outfit, 'Segoe UI', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";
    private static final int WIDTH = 560;

    private EmailLayout() {}

    public static Builder builder() {
        return new Builder();
    }

    /** A rendered mail: the HTML part and the equivalent plain-text part. */
    public record Rendered(String html, String text) {}

    /** One content block, able to render itself into either part. */
    private interface Block {
        String html();

        String text();
    }

    public static final class Builder {

        private final List<Block> blocks = new ArrayList<>();
        private String preheader = "";
        private String appUrl = "";
        private String footerNote = "";
        private final List<Link> footerLinks = new ArrayList<>();

        /** The short summary line clients show next to the subject in the inbox.
         *  Set it on every mail — otherwise clients scrape the body's first words. */
        public Builder preheader(String value) {
            this.preheader = value == null ? "" : value;
            return this;
        }

        /** Product URL used by the wordmark and the footer link. */
        public Builder appUrl(String value) {
            this.appUrl = value == null ? "" : value;
            return this;
        }

        public Builder heading(String value) {
            if (blank(value)) return this;
            return block(
                "<h1 style=\"margin:0 0 16px;font-size:22px;line-height:30px;font-weight:600;"
                    + "color:" + FOREGROUND + ";\">" + esc(value) + "</h1>",
                value + "\n" + "=".repeat(Math.min(value.length(), 60)));
        }

        public Builder paragraph(String value) {
            if (blank(value)) return this;
            return block(
                "<p style=\"margin:0 0 16px;font-size:15px;line-height:24px;color:"
                    + FOREGROUND + ";\">" + esc(value) + "</p>",
                value);
        }

        /** A secondary paragraph (muted) for context that isn't the main message. */
        public Builder muted(String value) {
            if (blank(value)) return this;
            return block(
                "<p style=\"margin:0 0 16px;font-size:13px;line-height:21px;color:"
                    + MUTED_FOREGROUND + ";\">" + esc(value) + "</p>",
                value);
        }

        /** The primary call to action. Also emitted in the text part as a URL, so
         *  the mail is never actionable in HTML only. */
        public Builder button(String label, String url) {
            if (blank(url) || blank(label)) return this;
            String safeUrl = esc(url);
            String html = """
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" \
                style="margin:4px 0 20px;"><tr><td style="border-radius:6px;background:%s;">\
                <a href="%s" style="display:inline-block;padding:11px 20px;font-size:15px;\
                font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;\
                border-radius:6px;">%s</a></td></tr></table>"""
                .formatted(BRAND, safeUrl, esc(label));
            return block(html, label + ": " + url);
        }

        /** A monospace panel for a code the recipient has to read and retype. */
        public Builder code(String value) {
            if (blank(value)) return this;
            String html = """
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" \
                border="0" style="margin:4px 0 20px;"><tr><td align="center" \
                style="padding:14px;background:%s;border:1px solid %s;border-radius:8px;\
                font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;\
                font-size:26px;font-weight:600;letter-spacing:6px;color:%s;">%s</td></tr></table>"""
                .formatted(MUTED, BORDER, FOREGROUND, esc(value));
            return block(html, "    " + value);
        }

        /** A label/value detail row (tier, amount, renewal date, …). Consecutive
         *  rows read as one table thanks to the shared borders. */
        public Builder row(String label, String value) {
            if (value == null || value.isBlank()) return this;
            String html = """
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" \
                border="0"><tr>\
                <td style="padding:7px 0;border-bottom:1px solid %s;font-size:14px;\
                line-height:20px;color:%s;">%s</td>\
                <td align="right" style="padding:7px 0;border-bottom:1px solid %s;\
                font-size:14px;line-height:20px;font-weight:600;color:%s;">%s</td>\
                </tr></table>"""
                .formatted(BORDER, MUTED_FOREGROUND, esc(label), BORDER, FOREGROUND, esc(value));
            return block(html, label + ": " + value);
        }

        /** A bulleted list — e.g. what a recipient is allowed to edit. */
        public Builder bullets(List<String> items) {
            if (items == null || items.isEmpty()) return this;
            var html = new StringBuilder(
                "<ul style=\"margin:0 0 16px;padding-left:20px;font-size:15px;line-height:24px;"
                    + "color:" + FOREGROUND + ";\">");
            var text = new StringBuilder();
            for (String item : items) {
                html.append("<li style=\"margin:0 0 6px;\">").append(esc(item)).append("</li>");
                text.append("  • ").append(item).append('\n');
            }
            html.append("</ul>");
            return block(html.toString(), text.toString().stripTrailing());
        }

        /** A tinted callout for the one thing the recipient should not miss
         *  (security notice, "this cannot be undone", …). */
        public Builder note(String value) {
            if (blank(value)) return this;
            String html = """
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" \
                border="0" style="margin:0 0 16px;"><tr><td style="padding:12px 14px;\
                background:%s;border-left:3px solid %s;border-radius:6px;font-size:14px;\
                line-height:21px;color:%s;">%s</td></tr></table>"""
                .formatted(MUTED, BRAND_ACCENT, FOREGROUND, esc(value));
            return block(html, "! " + value);
        }

        public Builder divider() {
            return block("<div style=\"height:1px;background:" + BORDER
                + ";margin:8px 0 20px;\"></div>", "--");
        }

        /** A closing line under the card (e.g. why this mail was sent). */
        public Builder footerNote(String value) {
            this.footerNote = value == null ? "" : value;
            return this;
        }

        /** An extra link in the footer (unsubscribe, imprint, privacy). */
        public Builder footerLink(String label, String url) {
            if (label != null && url != null && !url.isBlank()) {
                footerLinks.add(new Link(label, url));
            }
            return this;
        }

        private Builder block(String html, String text) {
            blocks.add(new Block() {
                @Override public String html() {
                    return html;
                }

                @Override public String text() {
                    return text;
                }
            });
            return this;
        }

        public Rendered build() {
            return new Rendered(renderHtml(), renderText());
        }

        // ── HTML ──────────────────────────────────────────────────

        private String renderHtml() {
            var body = new StringBuilder();
            for (Block b : blocks) body.append(b.html());
            return """
                <!doctype html>
                <html lang="en"><head><meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <meta name="color-scheme" content="light only">
                <meta name="supported-color-schemes" content="light only"></head>
                <body style="margin:0;padding:0;background:%s;-webkit-font-smoothing:antialiased;">
                <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:%s;\
                font-size:1px;line-height:1px;">%s</div>
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" \
                border="0" style="background:%s;"><tr><td align="center" style="padding:32px 16px;">
                <table role="presentation" width="%d" cellpadding="0" cellspacing="0" border="0" \
                style="width:100%%;max-width:%dpx;font-family:%s;">
                <tr><td style="padding:0 4px 16px;font-size:19px;font-weight:700;\
                letter-spacing:-0.2px;color:%s;">%s</td></tr>
                <tr><td style="background:%s;border:1px solid %s;border-radius:8px;\
                padding:28px 28px 12px;">%s</td></tr>
                <tr><td style="padding:16px 4px 0;font-size:12px;line-height:19px;color:%s;">\
                %s</td></tr>
                </table></td></tr></table></body></html>"""
                .formatted(PAGE, PAGE, esc(preheader), PAGE, WIDTH, WIDTH, FONT,
                    BRAND, wordmarkHtml(), CARD, BORDER, body, MUTED_FOREGROUND, footerHtml());
        }

        private String wordmarkHtml() {
            String mark = "Jack<span style=\"color:" + BRAND_ACCENT + ";\">poll</span>";
            return appUrl.isBlank() ? mark
                : "<a href=\"" + esc(appUrl) + "\" style=\"color:" + BRAND
                    + ";text-decoration:none;\">" + mark + "</a>";
        }

        private String footerHtml() {
            var out = new StringBuilder();
            if (!footerNote.isBlank()) {
                out.append("<div style=\"margin:0 0 6px;\">").append(esc(footerNote))
                    .append("</div>");
            }
            var links = new ArrayList<String>();
            if (!appUrl.isBlank()) links.add(linkHtml(new Link("Jackpoll", appUrl)));
            for (Link l : footerLinks) links.add(linkHtml(l));
            if (!links.isEmpty()) out.append(String.join("&nbsp;·&nbsp;", links));
            return out.toString();
        }

        private String linkHtml(Link l) {
            return "<a href=\"" + esc(l.url()) + "\" style=\"color:" + MUTED_FOREGROUND
                + ";text-decoration:underline;\">" + esc(l.label()) + "</a>";
        }

        // ── Plain text ────────────────────────────────────────────

        private String renderText() {
            var out = new StringBuilder();
            for (Block b : blocks) {
                String t = b.text();
                if (t == null || t.isBlank()) continue;
                out.append(t.strip()).append("\n\n");
            }
            out.append("--\n");
            if (!footerNote.isBlank()) out.append(footerNote).append('\n');
            if (!appUrl.isBlank()) out.append("Jackpoll: ").append(appUrl).append('\n');
            for (Link l : footerLinks) {
                out.append(l.label()).append(": ").append(l.url()).append('\n');
            }
            return out.toString();
        }
    }

    private record Link(String label, String url) {}

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    /** Escape the five characters that can break out of HTML text or an
     *  attribute value — templates pass user content (names, titles) verbatim. */
    static String esc(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&#39;");
    }
}
