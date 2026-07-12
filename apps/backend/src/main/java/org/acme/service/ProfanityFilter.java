package org.acme.service;

import jakarta.enterprise.context.ApplicationScoped;

import java.util.Set;

/**
 * Lightweight profanity gate for wordcloud submissions (EN + DE). Words are
 * normalized (lowercased, de-leetspeaked, non-letters stripped) and matched
 * exactly against a curated base list. Exact-match only — deliberately NOT
 * substring matching — to avoid the Scunthorpe problem (a clean word containing
 * a rude substring, e.g. "class"/"assume"). Normalization still catches casing,
 * leetspeak and punctuation padding like "$h1t" or "f.u.c.k".
 */
@ApplicationScoped
public class ProfanityFilter {

    // Common EN + DE profanities and slurs. Base forms only; normalization makes
    // matching tolerant of casing, leetspeak and padding.
    private static final Set<String> BLOCKLIST = Set.of(
        // English
        "fuck", "fucker", "fucking", "shit", "bullshit", "bitch", "bastard",
        "asshole", "ass", "dick", "cock", "cunt", "pussy", "whore", "slut",
        "nigger", "nigga", "faggot", "fag", "retard", "wanker", "twat",
        "motherfucker", "dickhead", "prick", "douche", "jackass",
        // German
        "scheisse", "scheise", "kacke", "arsch", "arschloch", "fotze",
        "schlampe", "hure", "wichser", "fick", "ficken", "ficker", "hurensohn",
        "schwuchtel", "missgeburt", "spasti", "spast", "nutte", "trottel",
        "idiot", "vollidiot", "depp"
    );

    /** Whether a single submitted word should be hidden from the cloud. */
    public boolean isProfane(String word) {
        if (word == null) return false;
        var norm = normalize(word);
        return !norm.isEmpty() && BLOCKLIST.contains(norm);
    }

    /**
     * Normalize for matching: lowercase, map common leetspeak to letters, drop
     * everything that is not a letter (so "$h1t" → "shit", "f.u.c.k" → "fuck").
     */
    static String normalize(String word) {
        var lower = word.toLowerCase();
        var sb = new StringBuilder(lower.length());
        for (int i = 0; i < lower.length(); i++) {
            char c = lower.charAt(i);
            switch (c) {
                case '0' -> sb.append('o');
                case '1', '!', '|' -> sb.append('i');
                case '3' -> sb.append('e');
                case '4', '@' -> sb.append('a');
                case '5', '$' -> sb.append('s');
                case '7' -> sb.append('t');
                case '8' -> sb.append('b');
                default -> {
                    if (Character.isLetter(c)) sb.append(c);
                }
            }
        }
        return sb.toString();
    }
}
