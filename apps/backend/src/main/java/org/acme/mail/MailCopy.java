package org.acme.mail;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The translated text of one mail bundle, loaded once from
 * {@code resources/mail/<bundle>_<locale>.properties}.
 *
 * <p>Recipients are addressed in their own language: supporting is
 * German-speaking, while the product and its docs are English, so both have to
 * read naturally. Keeping the copy in properties files rather than in the
 * templates means a wording or translation change never touches Java, and the
 * key set of the two files can be compared in a test to prove no string was
 * translated in one language and forgotten in the other.
 *
 * <p>Placeholders are {@code {0}}, {@code {1}} … and are substituted literally —
 * deliberately not through {@code MessageFormat}, whose single-quote escaping
 * silently mangles apostrophes ("Here's your link") in exactly the copy that
 * matters here.
 *
 * <p>An unknown locale, an untranslated key or a missing bundle all fall back to
 * English, so a gap degrades to the wrong language rather than to a blank mail.
 */
public final class MailCopy {

    /** Languages the mails exist in. The first is the fallback. */
    public static final String DEFAULT_LOCALE = "en";
    public static final Set<String> LOCALES = Set.of("en", "de");

    private static final Map<String, MailCopy> CACHE = new ConcurrentHashMap<>();

    private final String bundle;
    private final Map<String, Properties> byLocale;

    private MailCopy(String bundle, Map<String, Properties> byLocale) {
        this.bundle = bundle;
        this.byLocale = byLocale;
    }

    /** Load (and cache) a bundle by base name, e.g. {@code "messages"}. */
    public static MailCopy of(String bundle) {
        return CACHE.computeIfAbsent(bundle, name -> {
            Map<String, Properties> loaded = new LinkedHashMap<>();
            for (String locale : LOCALES) {
                loaded.put(locale, load(name, locale));
            }
            return new MailCopy(name, loaded);
        });
    }

    private static Properties load(String bundle, String locale) {
        var props = new Properties();
        String path = "mail/" + bundle + "_" + locale + ".properties";
        try (InputStream in = Thread.currentThread().getContextClassLoader()
                .getResourceAsStream(path)) {
            if (in != null) {
                props.load(new InputStreamReader(in, StandardCharsets.UTF_8));
            }
        } catch (IOException e) {
            throw new IllegalStateException("Could not read mail copy: " + path, e);
        }
        return props;
    }

    /**
     * The translated string for {@code key}, with {@code {0}}-style placeholders
     * filled from {@code args}. Falls back to English, then to the key itself
     * (visible but harmless — and immediately obvious in a preview).
     */
    public String t(String locale, String key, Object... args) {
        String value = byLocale.getOrDefault(normalize(locale), new Properties()).getProperty(key);
        if (value == null) {
            value = byLocale.getOrDefault(DEFAULT_LOCALE, new Properties()).getProperty(key);
        }
        if (value == null) return key;
        return format(value, args);
    }

    /** The keys defined for a locale — used by the parity test. */
    public Set<String> keys(String locale) {
        return byLocale.getOrDefault(normalize(locale), new Properties()).stringPropertyNames();
    }

    public String bundleName() {
        return bundle;
    }

    /**
     * Reduce anything a client might send — {@code "de"}, {@code "de-DE"},
     * {@code "de_DE"}, an {@code Accept-Language} list — to a supported language,
     * defaulting to English.
     */
    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) return DEFAULT_LOCALE;
        String first = raw.split(",")[0].trim();          // "de-DE;q=0.9" → "de-DE;q=0.9"
        first = first.split(";")[0].trim();               // → "de-DE"
        String language = first.replace('_', '-').split("-")[0].toLowerCase();
        return LOCALES.contains(language) ? language : DEFAULT_LOCALE;
    }

    private static String format(String template, Object... args) {
        if (args == null || args.length == 0) return template;
        String out = template;
        for (int i = 0; i < args.length; i++) {
            out = out.replace("{" + i + "}", args[i] == null ? "" : String.valueOf(args[i]));
        }
        return out;
    }
}
