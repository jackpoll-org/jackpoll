package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;

class PlainTextTest {

    @Test
    void stripsBasicMarkdown() {
        assertEquals("Read this first and see docs", PlainText.fromMarkdown("**Read** _this_ `first` and see [docs](https://e.com)"));
    }

    @Test
    void stripsRealisticQuizText() {
        assertEquals("use snake_case here", PlainText.fromMarkdown("**use snake_case here**"));
        assertEquals("bold it bold", PlainText.fromMarkdown("**bold *it* bold**"));
        assertEquals("wiki", PlainText.fromMarkdown("[wiki](https://en.wikipedia.org/wiki/Foo_(bar))"));
        assertEquals("x", PlainText.fromMarkdown("[x](https://a.com \"title\")"));
        assertEquals("a\n\nH", PlainText.fromMarkdown("a\n\n# H"));
        assertEquals("strike and under", PlainText.fromMarkdown("~~strike~~ and __under__"));
    }

    @Test
    void handlesHostileInputInLinearTime() {
        int n = 200_000;
        var inputs = List.of(
            " *a".repeat(n / 3),
            " **a".repeat(n / 4),
            "[".repeat(n),
            "[a](".repeat(n / 4),
            "\n".repeat(n) + "x",
            " \n".repeat(n / 2) + "x",
            " __a".repeat(n / 4),
            " ~~a".repeat(n / 4),
            "[a](b(".repeat(n / 6),
            "[a](b \"".repeat(n / 7)
        );
        assertTimeoutPreemptively(Duration.ofSeconds(2), () -> inputs.forEach(PlainText::fromMarkdown));
    }
}
