package org.acme.mail;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Guards the mail copy itself: a translation that silently loses a key, a
 * placeholder or a whole language is invisible in review but very visible in
 * someone's inbox.
 */
class MailCopyTest {

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{(\\d)}");

    /** Every key exists in every language — no half-translated bundle. */
    @ParameterizedTest
    @ValueSource(strings = { "messages"
    })
    void bundlesHaveTheSameKeysInEveryLanguage(String bundle) {
        var copy = MailCopy.of(bundle);
        var english = new TreeSet<>(copy.keys("en"));
        var german = new TreeSet<>(copy.keys("de"));
        assertFalse(english.isEmpty(), bundle + " has English copy");

        var missingInGerman = new TreeSet<>(english);
        missingInGerman.removeAll(german);
        assertTrue(missingInGerman.isEmpty(), "untranslated in de: " + missingInGerman);

        var strayInGerman = new TreeSet<>(german);
        strayInGerman.removeAll(english);
        assertTrue(strayInGerman.isEmpty(), "only in de: " + strayInGerman);
    }

    /** A translation that drops a {0} would render "Hi , your contribution…". */
    @ParameterizedTest
    @ValueSource(strings = { "messages"
    })
    void translationsKeepTheSamePlaceholders(String bundle) {
        var copy = MailCopy.of(bundle);
        for (String key : new TreeSet<>(copy.keys("en"))) {
            assertEquals(placeholders(copy.t("en", key)), placeholders(copy.t("de", key)),
                "placeholders differ for " + bundle + "." + key);
        }
    }

    /** Nothing is left empty — an empty value renders a blank line, not a fallback. */
    @ParameterizedTest
    @ValueSource(strings = { "messages"
    })
    void noEmptyValues(String bundle) {
        var copy = MailCopy.of(bundle);
        for (String locale : new String[] { "en", "de" }) {
            for (String key : new TreeSet<>(copy.keys(locale))) {
                assertFalse(copy.t(locale, key).isBlank(),
                    "empty copy: " + bundle + "." + key + " [" + locale + "]");
            }
        }
    }

    @Test
    void unknownKeyFallsBackToTheKeyItself() {
        assertEquals("no.such.key", MailCopy.of("messages").t("de", "no.such.key"));
    }

    @Test
    void placeholdersAreSubstitutedLiterally() {
        // Apostrophes must survive — MessageFormat would eat them.
        assertEquals("Your verification code: 123456",
            MailCopy.of("messages").t("en", "verify.subject", "123456"));
    }

    @Test
    void localeNormalizationAcceptsWhatClientsActuallySend() {
        assertEquals("de", MailCopy.normalize("de"));
        assertEquals("de", MailCopy.normalize("de-DE"));
        assertEquals("de", MailCopy.normalize("de_DE"));
        assertEquals("de", MailCopy.normalize("de-DE,de;q=0.9,en;q=0.8"));
        assertEquals("de", MailCopy.normalize("DE"));
        assertEquals("en", MailCopy.normalize("fr-FR"));   // unsupported → English
        assertEquals("en", MailCopy.normalize(null));
        assertEquals("en", MailCopy.normalize("  "));
    }

    private static Set<String> placeholders(String value) {
        var found = new TreeSet<String>();
        Matcher m = PLACEHOLDER.matcher(value);
        while (m.find()) found.add(m.group(1));
        return found;
    }
}
