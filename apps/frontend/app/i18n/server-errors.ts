import { DEFAULT_LOCALE, LOCALES, type Locale } from "./translations";

const EXACT_DE: Record<string, string> = {
  "A paragraph answer is too long.": "Eine Absatz-Antwort ist zu lang.",
  "A rating answer is out of range.": "Eine Bewertung liegt außerhalb des gültigen Bereichs.",
  "A slider answer is out of range.": "Ein Schieberegler-Wert liegt außerhalb des gültigen Bereichs.",
  "A user with this email already exists": "Es gibt bereits ein Konto mit dieser E-Mail-Adresse.",
  "Account not found": "Konto nicht gefunden.",
  "Account not found.": "Konto nicht gefunden.",
  "Code must be 6 digits": "Der Code muss 6 Ziffern haben.",
  "Code not found.": "Code nicht gefunden.",
  "Could not change the password. Please try again.": "Das Passwort konnte nicht geändert werden. Bitte versuche es erneut.",
  "Could not reset the password. Please try again.": "Das Passwort konnte nicht zurückgesetzt werden. Bitte versuche es erneut.",
  "Current password is incorrect": "Das aktuelle Passwort ist falsch.",
  "Draft has expired": "Der Entwurf ist abgelaufen.",
  "Draft not found": "Entwurf nicht gefunden.",
  "Editing is no longer available.": "Bearbeiten ist nicht mehr möglich.",
  "Email is required.": "E-Mail ist erforderlich.",
  "Empty file.": "Die Datei ist leer.",
  "File could not be virus-scanned right now. Please try again later.":
    "Die Datei konnte gerade nicht auf Viren geprüft werden. Bitte versuche es später erneut.",
  "Grading is only available for quizzes.": "Bewerten ist nur bei Quiz möglich.",
  "Host could not be resolved.": "Der Host konnte nicht aufgelöst werden.",
  "Invalid amount.": "Ungültiger Betrag.",
  "Invalid email or password": "E-Mail oder Passwort ist falsch.",
  "Invalid expiry date.": "Ungültiges Ablaufdatum.",
  "Invalid image key.": "Ungültiges Bild.",
  "Invalid or expired code. Please try again.": "Der Code ist ungültig oder abgelaufen. Bitte versuche es erneut.",
  "Invalid URL.": "Ungültige URL.",
  "Invalid value for a paragraph question.": "Ungültiger Wert für eine Absatz-Frage.",
  "Invalid value for a rating question.": "Ungültiger Wert für eine Bewertungsfrage.",
  "Invalid value for a slider question.": "Ungültiger Wert für eine Schieberegler-Frage.",
  "Link is too long.": "Der Link ist zu lang.",
  "Link must start with http:// or https://": "Der Link muss mit http:// oder https:// beginnen.",
  "Link not found.": "Link nicht gefunden.",
  "Live results are not enabled.": "Live-Ergebnisse sind nicht aktiviert.",
  "Name is required.": "Name ist erforderlich.",
  "No email address on file": "Es ist keine E-Mail-Adresse hinterlegt.",
  "No file provided.": "Keine Datei angegeben.",
  "No invitation for this survey.": "Keine Einladung für diese Umfrage.",
  "One of your selections is no longer available. Please choose another.":
    "Eine deiner Auswahlen ist nicht mehr verfügbar. Bitte wähle eine andere.",
  "Password must contain at least one uppercase letter, one lowercase letter, and one number":
    "Das Passwort muss mindestens einen Großbuchstaben, einen Kleinbuchstaben und eine Ziffer enthalten.",
  "Please accept the terms of use.": "Bitte akzeptiere die Nutzungsbedingungen.",
  "Please enter your name before submitting.": "Bitte gib vor dem Absenden deinen Namen ein.",
  "Please wait a minute before sending another test.": "Bitte warte eine Minute, bevor du einen weiteren Test sendest.",
  "Response not found.": "Antwort nicht gefunden.",
  "The password is incorrect.": "Das Passwort ist falsch.",
  "There is no answer to grade for this question.": "Für diese Frage gibt es keine Antwort zum Bewerten.",
  "This collaboration link has expired.": "Dieser Mitarbeits-Link ist abgelaufen.",
  "This link has expired.": "Dieser Link ist abgelaufen.",
  "This question can't be graded manually.": "Diese Frage kann nicht manuell bewertet werden.",
  "This survey has reached its response limit.": "Diese Umfrage hat ihr Antwortlimit erreicht.",
  "This survey is closed.": "Diese Umfrage ist geschlossen.",
  "This survey is no longer accepting responses.": "Diese Umfrage nimmt keine Antworten mehr an.",
  "This survey is not open yet.": "Diese Umfrage ist noch nicht geöffnet.",
  "This survey requires an access code.": "Für diese Umfrage ist ein Zugangscode erforderlich.",
  "This unsubscribe link is invalid or has expired.": "Dieser Abmeldelink ist ungültig oder abgelaufen.",
  "Too many attempts. Please wait a moment and try again.": "Zu viele Versuche. Bitte warte einen Moment und versuche es erneut.",
  "Too many invitations. Please try again later.": "Zu viele Einladungen. Bitte versuche es später erneut.",
  "Too many requests. Please wait a moment and try again.": "Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.",
  "Too many submissions. Please wait a moment and try again.": "Zu viele Einsendungen. Bitte warte einen Moment und versuche es erneut.",
  "Too many uploads. Please wait a moment and try again.": "Zu viele Uploads. Bitte warte einen Moment und versuche es erneut.",
  "Unsupported or corrupt file. Allowed: images (JPG, PNG, GIF, WEBP, SVG), PDF, Word/Excel/PowerPoint, TXT, CSV.":
    "Nicht unterstützte oder beschädigte Datei. Erlaubt: Bilder (JPG, PNG, GIF, WEBP, SVG), PDF, Word/Excel/PowerPoint, TXT, CSV.",
  "Upload not found.": "Upload nicht gefunden.",
  "URL must point to a public address.": "Die URL muss auf eine öffentliche Adresse zeigen.",
  "URL must start with http:// or https://": "Die URL muss mit http:// oder https:// beginnen.",
  "URL must use http or https.": "Die URL muss http oder https verwenden.",
  "User not found": "Benutzer nicht gefunden.",
  "Webhook not found": "Webhook nicht gefunden.",
  "You already own this survey.": "Diese Umfrage gehört dir bereits.",
  "You don't have edit access to this survey.": "Du hast keine Bearbeitungsrechte für diese Umfrage.",
  "You have already responded to this survey.": "Du hast bereits an dieser Umfrage teilgenommen.",
  "Your session has expired. Please sign in again.": "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
  "Your submission could not be processed.": "Deine Einsendung konnte nicht verarbeitet werden.",
  // Frontend fallbacks when a response carries no error text.
  "Draft not available": "Entwurf nicht verfügbar.",
  "Failed to accept invitation": "Einladung konnte nicht angenommen werden.",
  "Failed to add collaborator": "Mitarbeiter:in konnte nicht hinzugefügt werden.",
  "Failed to cancel": "Kündigung fehlgeschlagen.",
  "Failed to change password": "Passwort konnte nicht geändert werden.",
  "Failed to clear responses": "Antworten konnten nicht gelöscht werden.",
  "Failed to create folder": "Ordner konnte nicht erstellt werden.",
  "Failed to create survey": "Umfrage konnte nicht erstellt werden.",
  "Failed to create webhook": "Webhook konnte nicht erstellt werden.",
  "Failed to decline invitation": "Einladung konnte nicht abgelehnt werden.",
  "Failed to delete account": "Konto konnte nicht gelöscht werden.",
  "Failed to delete folder": "Ordner konnte nicht gelöscht werden.",
  "Failed to delete preview data": "Vorschaudaten konnten nicht gelöscht werden.",
  "Failed to delete response": "Antwort konnte nicht gelöscht werden.",
  "Failed to delete survey": "Umfrage konnte nicht gelöscht werden.",
  "Failed to delete template": "Vorlage konnte nicht gelöscht werden.",
  "Failed to delete webhook": "Webhook konnte nicht gelöscht werden.",
  "Failed to duplicate survey": "Umfrage konnte nicht dupliziert werden.",
  "Failed to load access code": "Zugangscode konnte nicht geladen werden.",
  "Failed to load analytics": "Statistiken konnten nicht geladen werden.",
  "Failed to load collab link": "Mitarbeits-Link konnte nicht geladen werden.",
  "Failed to load collaborators": "Mitarbeitende konnten nicht geladen werden.",
  "Failed to load folders": "Ordner konnten nicht geladen werden.",
  "Failed to load invitations": "Einladungen konnten nicht geladen werden.",
  "Failed to load leaderboard": "Rangliste konnte nicht geladen werden.",
  "Failed to load notification preferences": "Benachrichtigungseinstellungen konnten nicht geladen werden.",
  "Failed to load notifications": "Benachrichtigungen konnten nicht geladen werden.",
  "Failed to load responses": "Antworten konnten nicht geladen werden.",
  "Failed to load results": "Ergebnisse konnten nicht geladen werden.",
  "Failed to load sessions": "Sitzungen konnten nicht geladen werden.",
  "Failed to load share link": "Teilen-Link konnte nicht geladen werden.",
  "Failed to load survey": "Umfrage konnte nicht geladen werden.",
  "Failed to load surveys": "Umfragen konnten nicht geladen werden.",
  "Failed to load templates": "Vorlagen konnten nicht geladen werden.",
  "Failed to load unread count": "Anzahl ungelesener Benachrichtigungen konnte nicht geladen werden.",
  "Failed to load webhooks": "Webhooks konnten nicht geladen werden.",
  "Failed to mark all notifications read": "Benachrichtigungen konnten nicht als gelesen markiert werden.",
  "Failed to mark notification read": "Benachrichtigung konnte nicht als gelesen markiert werden.",
  "Failed to organize survey": "Umfrage konnte nicht einsortiert werden.",
  "Failed to remove collaborator": "Mitarbeiter:in konnte nicht entfernt werden.",
  "Failed to rename folder": "Ordner konnte nicht umbenannt werden.",
  "Failed to reorder surveys": "Umfragen konnten nicht neu sortiert werden.",
  "Failed to rotate": "Erneuern fehlgeschlagen.",
  "Failed to rotate code": "Code konnte nicht erneuert werden.",
  "Failed to rotate link": "Link konnte nicht erneuert werden.",
  "Failed to save": "Speichern fehlgeschlagen.",
  "Failed to save draft": "Entwurf konnte nicht gespeichert werden.",
  "Failed to save grade": "Bewertung konnte nicht gespeichert werden.",
  "Failed to save notification preferences": "Benachrichtigungseinstellungen konnten nicht gespeichert werden.",
  "Failed to save survey": "Umfrage konnte nicht gespeichert werden.",
  "Failed to save template": "Vorlage konnte nicht gespeichert werden.",
  "Failed to send test": "Test konnte nicht gesendet werden.",
  "Failed to start": "Start fehlgeschlagen.",
  "Failed to start checkout": "Bezahlvorgang konnte nicht gestartet werden.",
  "Failed to start the session": "Sitzung konnte nicht gestartet werden.",
  "Failed to submit response": "Antwort konnte nicht gesendet werden.",
  "Failed to update": "Aktualisieren fehlgeschlagen.",
  "Failed to update code": "Code konnte nicht aktualisiert werden.",
  "Failed to update link": "Link konnte nicht aktualisiert werden.",
  "Failed to update live state": "Live-Status konnte nicht aktualisiert werden.",
  "Failed to update profile": "Profil konnte nicht aktualisiert werden.",
  "Failed to update response": "Antwort konnte nicht aktualisiert werden.",
  "Live results unavailable": "Live-Ergebnisse nicht verfügbar.",
  "Not authenticated": "Nicht angemeldet.",
  "Survey not available": "Umfrage nicht verfügbar.",
  "This edit link is not available.": "Dieser Bearbeitungslink ist nicht verfügbar.",
  "This link is not available.": "Dieser Link ist nicht verfügbar.",
  "Captcha challenge could not be solved": "Die Captcha-Prüfung konnte nicht gelöst werden.",
  "Could not export your data. Please try again.": "Deine Daten konnten nicht exportiert werden. Bitte versuche es erneut.",
  // Bean Validation defaults (backend ValidationExceptionMapper).
  "must not be blank": "darf nicht leer sein",
  "must not be null": "darf nicht fehlen",
  "must not be empty": "darf nicht leer sein",
  "must be a well-formed email address": "muss eine gültige E-Mail-Adresse sein",
};

const FIELDS_DE: Record<string, string> = {
  "First name": "Vorname",
  "Last name": "Nachname",
  "Street and number": "Straße und Hausnummer",
  City: "Ort",
  "Company name": "Firmenname",
  "Address line 2": "Adresszusatz",
};
const field = (name: string) => FIELDS_DE[name] ?? name;

const PATTERNS_DE: [RegExp, (...m: string[]) => string][] = [
  [/^(Survey|Folder|Template|Notification|Response|Upload) not found(: .*)?\.?$/, (_, what) =>
    `${{ Survey: "Umfrage", Folder: "Ordner", Template: "Vorlage", Notification: "Benachrichtigung", Response: "Antwort", Upload: "Upload" }[what]} nicht gefunden.`],
  [/^Question (\d+) needs a title before publishing\.$/, (_, n) => `Frage ${n} braucht vor dem Veröffentlichen einen Titel.`],
  [/^Question (\d+) has an empty answer option — fill it in before publishing\.$/, (_, n) =>
    `Frage ${n} hat eine leere Antwortoption – fülle sie vor dem Veröffentlichen aus.`],
  [/^File exceeds the maximum size of (\d+) MB\.$/, (_, n) => `Die Datei überschreitet die maximale Größe von ${n} MB.`],
  [/^File rejected: it failed a malware scan \((.*)\)\.$/, (_, t) => `Datei abgelehnt: Der Virenscan hat angeschlagen (${t}).`],
  [/^No user with email (.+)\. They must register first\.$/, (_, e) => `Kein Konto mit der E-Mail ${e}. Die Person muss sich zuerst registrieren.`],
  [/^Points must be between 0 and (.+)\.$/, (_, n) => `Die Punkte müssen zwischen 0 und ${n} liegen.`],
  [/^Minimum for (\S+) (\S+) is €(.+)\.$/, (_, tier, interval, min) => `Mindestbetrag für ${tier} (${interval}): ${min} €.`],
  [/^Description must be at most (\d+) characters\.$/, (_, n) => `Die Beschreibung darf höchstens ${n} Zeichen lang sein.`],
  [/^(.+) must be at most (\d+) characters\.$/, (_, f, n) => `${field(f)} darf höchstens ${n} Zeichen lang sein.`],
  [/^(.+) is required\.$/, (_, f) => `${field(f)} ist erforderlich.`],
  [/^You can change your display name again on (.+)$/, (_, d) => {
    const date = new Date(d);
    return `Du kannst deinen Anzeigenamen wieder ab ${Number.isNaN(date.getTime()) ? d : date.toLocaleString("de-DE")} ändern.`;
  }],
  [/^size must be between (\d+) and (\d+)$/, (_, a, b) => `Länge muss zwischen ${a} und ${b} liegen`],
  [/^must be greater than or equal to (.+)$/, (_, n) => `muss größer oder gleich ${n} sein`],
  [/^must be less than or equal to (.+)$/, (_, n) => `muss kleiner oder gleich ${n} sein`],
  [/^(?:Request|Upload) failed with status (\d+)$/, (_, s) => `Anfrage fehlgeschlagen (Status ${s}).`],
];

function translateDe(message: string): string {
  const exact = EXACT_DE[message];
  if (exact) return exact;
  for (const [re, fn] of PATTERNS_DE) {
    const m = message.match(re);
    if (m) return fn(...m);
  }
  return message;
}

function currentLocale(): Locale {
  const lang = typeof document !== "undefined" ? document.documentElement.lang.split("-")[0].toLowerCase() : "";
  return (LOCALES as readonly string[]).includes(lang) ? (lang as Locale) : DEFAULT_LOCALE;
}

/** Backend error messages are English; show them in the app's language. */
export function localizeServerError(message: string, locale: Locale = currentLocale()): string {
  if (locale !== "de") return message;
  // Validation errors arrive as "path.to.field: message, other.field: message".
  if (/^[\w.[\]]+: /.test(message)) {
    return message
      .split(/, (?=[\w.[\]]+: )/)
      .map((part) => translateDe(part.replace(/^[\w.[\]]+: /, "")))
      .join(", ");
  }
  return translateDe(message);
}
