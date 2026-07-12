"use client";

import { useTranslation } from "@/app/i18n/context";
import { LEGAL } from "@/app/lib/legal/config";
import { LegalProse } from "@/app/components/legal/legal-prose";

/**
 * Impressum per § 5 DDG / § 18 MStV (#62). Bilingual; operator details come
 * from the env-overridable LEGAL config so self-host instances show their own
 * entity. Defaults are the Quavon details.
 */
export function ImpressumContent() {
  const { locale } = useTranslation();
  const de = locale === "de";

  return (
    <LegalProse>
      <h1>{de ? "Impressum" : "Legal Notice (Impressum)"}</h1>

      <h2>{de ? "Angaben gemäß § 5 DDG" : "Information pursuant to § 5 DDG"}</h2>
      <p>
        {LEGAL.operator}
        <br />
        {LEGAL.brand}
        <br />
        {LEGAL.street}
        <br />
        {LEGAL.city}
        <br />
        {LEGAL.country}
      </p>

      <h2>{de ? "Kontakt" : "Contact"}</h2>
      <p>
        {de ? "Telefon" : "Phone"}: {LEGAL.phone}
        <br />
        {de ? "E-Mail" : "Email"}: <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
      </p>

      <h2>
        {de
          ? "Redaktionell verantwortlich (§ 18 Abs. 2 MStV)"
          : "Responsible for content (§ 18 (2) MStV)"}
      </h2>
      <p>
        {LEGAL.responsible}
        <br />
        {LEGAL.street}, {LEGAL.city}
      </p>

      <h2>{de ? "Haftung für Inhalte" : "Liability for content"}</h2>
      <p>
        {de
          ? "Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt."
          : "As a service provider we are responsible for our own content on these pages under the general laws (§ 7 (1) DDG). Under §§ 8–10 DDG, however, we are not obliged to monitor transmitted or stored third-party information or to investigate circumstances indicating illegal activity. Obligations to remove or block the use of information under the general laws remain unaffected."}
      </p>

      <h2>{de ? "Haftung für Links" : "Liability for links"}</h2>
      <p>
        {de
          ? "Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich."
          : "Our service contains links to external third-party websites whose content we cannot influence. We therefore accept no liability for this third-party content. The respective provider or operator of the linked pages is always responsible for their content."}
      </p>

      <h2>{de ? "Streitschlichtung" : "Dispute resolution"}</h2>
      <p>
        {de
          ? "Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen."
          : "We are neither willing nor obliged to take part in dispute-resolution proceedings before a consumer arbitration board."}
      </p>

      <p className="text-sm text-muted-foreground">
        {de ? "Stand" : "Last updated"}: {LEGAL.lastUpdated}
      </p>
    </LegalProse>
  );
}
