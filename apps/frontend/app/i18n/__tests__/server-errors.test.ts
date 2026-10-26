import { describe, expect, it } from "vitest";
import { localizeServerError } from "@/app/i18n/server-errors";

describe("localizeServerError", () => {
  it("leaves English untouched", () => {
    expect(localizeServerError("This survey is closed.", "en")).toBe("This survey is closed.");
  });

  it("translates exact and patterned backend messages to German", () => {
    expect(localizeServerError("This survey is closed.", "de")).toBe("Diese Umfrage ist geschlossen.");
    expect(localizeServerError("Survey not found: abc", "de")).toBe("Umfrage nicht gefunden.");
    expect(localizeServerError("Question 3 needs a title before publishing.", "de")).toBe(
      "Frage 3 braucht vor dem Veröffentlichen einen Titel.",
    );
    expect(localizeServerError("First name is required.", "de")).toBe("Vorname ist erforderlich.");
    expect(localizeServerError("Request failed with status 502", "de")).toBe("Anfrage fehlgeschlagen (Status 502).");
  });

  it("strips field paths from validation errors", () => {
    expect(localizeServerError("register.arg0.email: must not be blank, register.arg0.code: Code must be 6 digits", "de")).toBe(
      "darf nicht leer sein, Der Code muss 6 Ziffern haben.",
    );
  });

  it("follows the page language, defaulting to German", () => {
    const html = document.documentElement;
    try {
      html.lang = "";
      expect(localizeServerError("This survey is closed.")).toBe("Diese Umfrage ist geschlossen.");
      html.lang = "de-DE";
      expect(localizeServerError("This survey is closed.")).toBe("Diese Umfrage ist geschlossen.");
      html.lang = "en-US";
      expect(localizeServerError("This survey is closed.")).toBe("This survey is closed.");
    } finally {
      html.lang = "en";
    }
  });

  it("passes unknown messages through", () => {
    expect(localizeServerError("Something new", "de")).toBe("Something new");
  });
});
