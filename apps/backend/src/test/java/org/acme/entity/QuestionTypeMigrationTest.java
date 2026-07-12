package org.acme.entity;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

/**
 * Guards against the failure that let WORDCLOUD ship without its DB migration:
 * the prod schema enforces a `questions_type_check` CHECK constraint listing the
 * allowed type names, but tests run on a Hibernate drop-and-create schema that
 * has no such constraint — so a missing migration only surfaces in production as
 * a 500. This pure test (no container) asserts the latest migration that
 * (re)creates the constraint lists every {@link QuestionType}.
 */
class QuestionTypeMigrationTest {

    private static final Path MIGRATIONS = Path.of("src/main/resources/db/migration");
    private static final Pattern VERSION = Pattern.compile("V(\\d+)__");

    @Test
    void everyQuestionTypeIsAllowedByTheLatestCheckConstraintMigration() {
        var content = latestTypeCheckMigration();
        for (var type : QuestionType.values()) {
            assertTrue(
                content.contains("'" + type.name() + "'"),
                "QuestionType." + type.name()
                    + " is missing from questions_type_check — add a migration"
                    + " (see V7–V16) that recreates the constraint with the full"
                    + " current type set, otherwise prod rejects it with a 500.");
        }
    }

    /** Body of the highest-versioned migration that defines questions_type_check. */
    private static String latestTypeCheckMigration() {
        try (Stream<Path> files = Files.list(MIGRATIONS)) {
            return files
                .filter(p -> p.getFileName().toString().endsWith(".sql"))
                .filter(QuestionTypeMigrationTest::definesTypeCheck)
                .max(Comparator.comparingInt(QuestionTypeMigrationTest::version))
                .map(QuestionTypeMigrationTest::read)
                .orElseGet(() -> {
                    fail("No migration defines questions_type_check");
                    return "";
                });
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static boolean definesTypeCheck(Path p) {
        return read(p).contains("questions_type_check");
    }

    private static int version(Path p) {
        Matcher m = VERSION.matcher(p.getFileName().toString());
        return m.find() ? Integer.parseInt(m.group(1)) : -1;
    }

    private static String read(Path p) {
        try {
            return Files.readString(p);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
