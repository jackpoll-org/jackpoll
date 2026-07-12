"use client";

import Link from "next/link";
import { useTranslation } from "@/app/i18n/context";
import { LEGAL } from "@/app/lib/legal/config";
import { LegalProse } from "@/app/components/legal/legal-prose";

/**
 * Privacy policy / Datenschutzerklärung (#61) incl. the cookie/local-storage
 * section (#67). Bilingual (DE/EN), tied to the app's actual data flows
 * (accounts, surveys, responses, files #3, receipts #24, push #46/#74,
 * hashed client ids #31, Altcha proof-of-work spam protection). No web
 * analytics are used.
 */
export function PrivacyContent() {
  const { locale } = useTranslation();
  const de = locale === "de";

  return (
    <LegalProse>
      <h1>{de ? "Datenschutzerklärung" : "Privacy Policy"}</h1>
      <p className="text-sm text-muted-foreground">
        {de ? "Stand" : "Last updated"}: {LEGAL.lastUpdated}
      </p>

      {/* 1. Controller */}
      <h2>{de ? "1. Verantwortlicher" : "1. Controller"}</h2>
      <p>
        {LEGAL.operator} ({LEGAL.brand})
        <br />
        {LEGAL.street}, {LEGAL.city}, {LEGAL.country}
        <br />
        {de ? "E-Mail" : "Email"}: <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
        <br />
        {de ? "Telefon" : "Phone"}: {LEGAL.phone}
        <br />
        <Link href="/impressum">{de ? "Impressum" : "Imprint"}</Link>
      </p>

      {/* 2. Data we process */}
      <h2>{de ? "2. Welche Daten wir verarbeiten" : "2. What data we process"}</h2>
      <ul>
        <li>
          <strong>{de ? "Kontodaten:" : "Account data:"}</strong>{" "}
          {de
            ? "E-Mail-Adresse, Name, verschlüsselte Anmeldedaten, Anmeldezeitpunkte, Benachrichtigungseinstellungen (verwaltet über Keycloak)."
            : "email address, name, encrypted credentials, login timestamps, notification preferences (managed via Keycloak)."}
        </li>
        <li>
          <strong>{de ? "Umfragen & Inhalte:" : "Surveys & content:"}</strong>{" "}
          {de
            ? "von Ihnen erstellte Umfragen, Fragen, Einstellungen und Antworten."
            : "surveys, questions, settings and responses you create."}
        </li>
        <li>
          <strong>{de ? "Antwortdaten:" : "Response data:"}</strong>{" "}
          {de
            ? "Antwortinhalte; optional die E-Mail-Adresse von Teilnehmenden für Empfangsbestätigungen (Opt-in); hochgeladene Dateien und Signaturen."
            : "answer content; optionally a respondent's email for receipts (opt-in); uploaded files and signatures."}
        </li>
        <li>
          <strong>{de ? "Push-Token:" : "Push tokens:"}</strong>{" "}
          {de
            ? "Geräte-Token bzw. Web-Push-Abonnement, wenn Sie Benachrichtigungen aktivieren."
            : "device token or Web Push subscription if you enable notifications."}
        </li>
        <li>
          <strong>{de ? "Sicherheit/Spam-Schutz:" : "Security / spam protection:"}</strong>{" "}
          {de
            ? "ein per HMAC gehashter Klient-Identifikator (es wird keine rohe IP-Adresse gespeichert) sowie eine Proof-of-Work-Prüfung (Altcha), die ohne Cookies und ohne Drittanbieter direkt auf unserem Server läuft."
            : "an HMAC-hashed client identifier (no raw IP address is stored) and a proof-of-work check (Altcha) that runs directly on our own server without cookies or third parties."}
        </li>
      </ul>

      {/* 3. Purposes & legal bases */}
      <h2>{de ? "3. Zwecke und Rechtsgrundlagen" : "3. Purposes and legal bases"}</h2>
      <ul>
        <li>
          {de
            ? "Bereitstellung des Dienstes (Konto, Umfragen, Antworten) – Art. 6 Abs. 1 lit. b DSGVO (Vertrag)."
            : "Providing the service (account, surveys, responses) — Art. 6(1)(b) GDPR (contract)."}
        </li>
        <li>
          {de
            ? "Empfangsbestätigungen und Benachrichtigungen – Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)."
            : "Receipts and notifications — Art. 6(1)(a) GDPR (consent)."}
        </li>
        <li>
          {de
            ? "Sicherheit, Missbrauchs- und Spam-Abwehr – Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse)."
            : "Security, abuse and spam prevention — Art. 6(1)(f) GDPR (legitimate interest)."}
        </li>
      </ul>

      {/* 4. Cookies & local storage (#67) */}
      <h2 id="cookies">
        {de ? "4. Cookies & lokaler Speicher" : "4. Cookies & local storage"}
      </h2>
      <p>
        {de
          ? "Wir verwenden ausschließlich technisch notwendige Cookies bzw. lokalen Speicher. Es werden keine Tracking- oder Marketing-Cookies gesetzt, daher ist kein Cookie-Banner erforderlich (Art. 6 Abs. 1 lit. f DSGVO / § 25 Abs. 2 TDDDG, unbedingt erforderlich)."
          : "We use only strictly necessary cookies / local storage. No tracking or marketing cookies are set, so no consent banner is required (Art. 6(1)(f) GDPR / § 25(2) TDDDG, strictly necessary)."}
      </p>
      <table>
        <thead>
          <tr>
            <th>{de ? "Name" : "Name"}</th>
            <th>{de ? "Zweck" : "Purpose"}</th>
            <th>{de ? "Typ" : "Type"}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>survey-auth-token</td>
            <td>{de ? "Anmeldesitzung" : "Authentication session"}</td>
            <td>Cookie</td>
          </tr>
          <tr>
            <td>locale</td>
            <td>{de ? "Spracheinstellung" : "Language preference"}</td>
            <td>Cookie</td>
          </tr>
          <tr>
            <td>theme / theme-preset / radius / scale</td>
            <td>{de ? "Darstellung (Hell/Dunkel, Theme)" : "Appearance (light/dark, theme)"}</td>
            <td>Cookie / localStorage</td>
          </tr>
          <tr>
            <td>{de ? "Offline-Cache" : "Offline cache"}</td>
            <td>{de ? "Offline-Nutzung von Umfragen (Service Worker)" : "Offline survey use (service worker)"}</td>
            <td>Cache API</td>
          </tr>
          <tr>
            <td>{de ? "App-Speicher (nur App)" : "App storage (native only)"}</td>
            <td>{de ? "Server-URL, Sitzungstoken (Schlüsselbund)" : "Server URL, session token (keychain)"}</td>
            <td>Preferences / Keychain</td>
          </tr>
        </tbody>
      </table>
      <p>
        {de
          ? "Wir setzen keine Webanalyse-, Tracking- oder Marketing-Dienste ein."
          : "We do not use any web-analytics, tracking or marketing services."}
      </p>

      {/* 5. Recipients / processors */}
      <h2>{de ? "5. Empfänger / Auftragsverarbeiter" : "5. Recipients / processors"}</h2>
      <p>
        {de
          ? "Wir setzen sorgfältig ausgewählte Auftragsverarbeiter ein: Keycloak (Identitätsverwaltung), MinIO/S3 (Datei-Uploads), einen SMTP-Anbieter (E-Mail-Versand) sowie optional Google FCM bzw. Browser-Push-Dienste (nur bei aktivierten Benachrichtigungen). Mit allen externen Verarbeitern bestehen Verträge zur Auftragsverarbeitung (Art. 28 DSGVO)."
          : "We use carefully selected processors: Keycloak (identity), MinIO/S3 (file uploads), an SMTP provider (email), and optionally Google FCM / browser push services (only when notifications are enabled). Data Processing Agreements (Art. 28 GDPR) are in place with all external processors."}
      </p>

      {/* 6. Retention */}
      <h2>{de ? "6. Speicherdauer und Löschung" : "6. Retention and deletion"}</h2>
      <p>
        {de
          ? "Wir speichern personenbezogene Daten nur so lange, wie es für die genannten Zwecke erforderlich ist. Kontodaten werden bis zur Löschung Ihres Kontos gespeichert (Selbstbedienung: „Konto löschen“, Art. 17 DSGVO). Gespeicherte Entwürfe werden nach 30 Tagen automatisch gelöscht. Umfrage-Ersteller können je Umfrage eine Aufbewahrungsfrist festlegen; ältere Antworten werden danach automatisch gelöscht oder anonymisiert."
          : "We retain personal data only as long as necessary for the stated purposes. Account data is kept until you delete your account (self-service “Delete account”, Art. 17 GDPR). Saved drafts are auto-deleted after 30 days. Survey owners can set a per-survey retention period after which older responses are automatically deleted or anonymised."}
      </p>

      {/* 7. Third countries */}
      <h2>{de ? "7. Drittlandübermittlung" : "7. Third-country transfers"}</h2>
      <p>
        {de
          ? "Die Verarbeitung und Speicherung erfolgt ausschließlich auf Servern in Deutschland. Eine Ausnahme bilden ausschließlich die optionalen Push-Dienste (Google FCM / Browser-Push), die nur bei aktivierten Benachrichtigungen genutzt werden; Web-Push-Inhalte sind dabei Ende-zu-Ende verschlüsselt."
          : "Processing and storage take place exclusively on servers in Germany. The only exception is the optional push services (Google FCM / browser push), used only when notifications are enabled; Web Push payloads are end-to-end encrypted."}
      </p>

      {/* 8. Rights */}
      <h2>{de ? "8. Ihre Rechte" : "8. Your rights"}</h2>
      <p>
        {de
          ? "Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21). Einen Export Ihrer Daten und die Löschung Ihres Kontos können Sie direkt in den Kontoeinstellungen vornehmen. Für weitere Anliegen kontaktieren Sie uns unter "
          : "You have the right to access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction (Art. 18), data portability (Art. 20) and objection (Art. 21). You can export your data and delete your account directly in account settings. For anything else, contact us at "}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </p>

      {/* 9. Complaint */}
      <h2>{de ? "9. Beschwerderecht" : "9. Right to complain"}</h2>
      <p>
        {de
          ? "Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Zuständig ist u. a.: "
          : "You have the right to lodge a complaint with a data-protection supervisory authority, including: "}
        {LEGAL.supervisoryAuthority}.
      </p>

      {/* 10. Security */}
      <h2>{de ? "10. Sicherheit" : "10. Security"}</h2>
      <p>
        {de
          ? "Wir treffen geeignete technische und organisatorische Maßnahmen (Art. 32 DSGVO): TLS-Verschlüsselung in der Übertragung, Verschlüsselung ruhender Daten, gehashte Passwörter und Klient-Identifikatoren, Zugriffskontrolle über Keycloak sowie regelmäßige Sicherungen."
          : "We take appropriate technical and organisational measures (Art. 32 GDPR): TLS encryption in transit, encryption at rest, hashed passwords and client identifiers, access control via Keycloak, and regular backups."}
      </p>

      {/* 11. Respondents */}
      <h2>{de ? "11. Umfrage-Teilnehmende" : "11. Survey respondents"}</h2>
      <p>
        {de
          ? "Wenn Sie an einer Umfrage teilnehmen, ist die jeweilige Umfrage-Erstellerin bzw. der Ersteller für die erhobenen Antwortdaten verantwortlich und legt Zweck und Rechtsgrundlage fest. Eine etwaige umfragespezifische Datenschutzinformation wird vor dem Absenden angezeigt."
          : "When you take part in a survey, the survey's owner is the controller for the response data collected and determines the purpose and legal basis. Any survey-specific privacy notice is shown before you submit."}
      </p>

      {/* 12. Changes */}
      <h2>{de ? "12. Änderungen" : "12. Changes"}</h2>
      <p>
        {de
          ? "Wir können diese Datenschutzerklärung anpassen, um sie an geänderte Rechtslagen oder Funktionen anzupassen. Es gilt die jeweils aktuelle, hier veröffentlichte Fassung."
          : "We may update this privacy policy to reflect changes in the law or features. The current version published here applies."}
      </p>

      <div className="flex flex-col items-center gap-4 pt-4 sm:flex-row sm:justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/badges/DSGVO-Badge.svg"
          alt="DSGVO-konform"
          className="h-auto w-full max-w-64"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/badges/GDPR-Badge.svg"
          alt="GDPR compliant"
          className="h-auto w-full max-w-64"
        />
      </div>
    </LegalProse>
  );
}
