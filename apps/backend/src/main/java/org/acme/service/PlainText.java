package org.acme.service;

import java.util.regex.Pattern;

final class PlainText {

    private static final Pattern PIPING = Pattern.compile("\\{\\{\\s*[\\w-]+\\s*\\}\\}");
    private static final Pattern FENCE = Pattern.compile("(?m)^[ \\t]*```.*$\\n?");
    private static final Pattern HEADING = Pattern.compile("(?m)^[ \\t]{0,3}#{1,6}[ \\t]+");
    private static final Pattern QUOTE = Pattern.compile("(?m)^[ \\t]{0,3}>[ \\t]?");
    private static final Pattern BULLET = Pattern.compile("(?m)^([ \\t]*)[-*+][ \\t]+");
    private static final Pattern LINK = Pattern.compile("!?\\[([^\\[\\]\\n]*)\\]\\((?:[^()\\s]|\\([^()\\s]*\\))*(?:[ \\t]+\"[^\"\\n]*\")?\\)");
    private static final Pattern STRONG = Pattern.compile(
        "\\*\\*(?!\\s)([^*\\n]+?)(?<!\\s)\\*\\*|__(?!\\s)([^_\\n]+?)(?<!\\s)__|~~(?!\\s)([^~\\n]+?)(?<!\\s)~~");
    private static final Pattern EMPHASIS = Pattern.compile("(?<![\\w*])([*_])(?!\\s)([^*_\\n]+?)(?<!\\s)\\1(?![\\w*])");
    private static final Pattern CODE = Pattern.compile("`([^`]*)`");

    private PlainText() {}

    static String withoutPiping(String text) {
        return text == null ? null : PIPING.matcher(text).replaceAll("");
    }

    static String fromMarkdown(String markdown) {
        if (markdown == null) return null;
        var text = FENCE.matcher(markdown).replaceAll("");
        text = HEADING.matcher(text).replaceAll("");
        text = QUOTE.matcher(text).replaceAll("");
        text = BULLET.matcher(text).replaceAll("$1• ");
        text = LINK.matcher(text).replaceAll("$1");
        text = EMPHASIS.matcher(text).replaceAll("$2");
        text = STRONG.matcher(text).replaceAll(m -> java.util.regex.Matcher.quoteReplacement(
            m.group(1) != null ? m.group(1) : m.group(2) != null ? m.group(2) : m.group(3)));
        return CODE.matcher(text).replaceAll("$1");
    }

    static boolean hasText(String text) {
        return text != null && !text.isBlank();
    }
}
