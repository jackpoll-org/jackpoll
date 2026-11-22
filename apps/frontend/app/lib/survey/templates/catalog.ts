import type { Locale } from "@/app/i18n/translations";
import type { Option, Question, QuestionType } from "@/app/types/survey";
import type { SurveyTemplate } from "./types";

/** Curated, ship-with-the-product templates (issue #17), in the given locale. */
export function curatedTemplates(locale: Locale): SurveyTemplate[] {
  const l = (en: string, german: string, french: string) =>
    locale === "de" ? german : locale === "fr" ? french : en;

  // Local id counter — template ids are placeholders, regenerated on use.
  let counter = 0;
  const uid = () => `tpl-${counter++}`;
  const opt = (label: string): Option => ({ id: uid(), label });
  const q = (
    type: QuestionType,
    title: string,
    extra: Partial<Question> = {},
  ): Question => ({ id: uid(), type, title, required: false, order: 0, ...extra });

  const paris = opt("Paris");

  return [
    {
      id: "event-rsvp",
      name: l("Event RSVP", "Event-Anmeldung", "Inscription à un événement"),
      description: l(
        "Collect attendance and guest counts for an event.",
        "Erfasse Zusagen und Gästezahlen für eine Veranstaltung.",
        "Recueillez les confirmations de présence et le nombre d’invités pour un événement.",
      ),
      category: "rsvp",
      source: "curated",
      questions: [
        q("short-answer", l("Your name", "Dein Name", "Votre nom"), { required: true }),
        q("multiple-choice", l("Will you attend?", "Kommst du?", "Serez-vous présent ?"), {
          required: true,
          options: [
            opt(l("Yes", "Ja", "Oui")),
            opt(l("No", "Nein", "Non")),
            opt(l("Maybe", "Vielleicht", "Peut-être")),
          ],
        }),
        q("short-answer", l("Number of guests", "Anzahl der Gäste", "Nombre d’invités")),
        q("short-answer", l("Dietary requirements", "Ernährungswünsche", "Régime alimentaire")),
      ],
    },
    {
      id: "customer-feedback",
      name: l("Customer Feedback", "Kundenfeedback", "Avis clients"),
      description: l(
        "Measure satisfaction and gather improvement ideas.",
        "Miss die Zufriedenheit und sammle Verbesserungsideen.",
        "Mesurez la satisfaction et recueillez des idées d’amélioration.",
      ),
      category: "feedback",
      source: "curated",
      questions: [
        q("multiple-choice", l("How satisfied are you?", "Wie zufrieden bist du?", "Quel est votre niveau de satisfaction ?"), {
          required: true,
          options: [
            opt(l("Very satisfied", "Sehr zufrieden", "Très satisfait")),
            opt(l("Satisfied", "Zufrieden", "Satisfait")),
            opt(l("Neutral", "Neutral", "Neutre")),
            opt(l("Dissatisfied", "Unzufrieden", "Insatisfait")),
          ],
        }),
        q("checkboxes", l("What did you like?", "Was hat dir gefallen?", "Qu’avez-vous apprécié ?"), {
          options: [
            opt(l("Quality", "Qualität", "Qualité")),
            opt(l("Price", "Preis", "Prix")),
            opt(l("Support", "Support", "Assistance")),
            opt(l("Speed", "Geschwindigkeit", "Rapidité")),
          ],
        }),
        q("short-answer", l("Anything we can improve?", "Was können wir verbessern?", "Que pourrions-nous améliorer ?")),
      ],
    },
    {
      id: "team-vote",
      name: l("Team Vote", "Team-Abstimmung", "Vote d’équipe"),
      description: l(
        "Let a team decide between options quickly.",
        "Lass ein Team schnell zwischen Optionen entscheiden.",
        "Permettez à une équipe de choisir rapidement entre plusieurs options.",
      ),
      category: "vote",
      source: "curated",
      questions: [
        q("multiple-choice", l("Pick your preferred option", "Wähle deine bevorzugte Option", "Choisissez l’option que vous préférez"), {
          required: true,
          options: [
            opt(l("Option A", "Option A", "Option A")),
            opt(l("Option B", "Option B", "Option B")),
            opt(l("Option C", "Option C", "Option C")),
          ],
        }),
        q("short-answer", l("Why did you pick this?", "Warum hast du das gewählt?", "Pourquoi ce choix ?")),
      ],
    },
    {
      id: "quiz-round",
      name: l("Quiz Round", "Quizrunde", "Manche de quiz"),
      description: l(
        "A scored quiz with correct answers and points.",
        "Ein bewertetes Quiz mit richtigen Antworten und Punkten.",
        "Un quiz noté avec bonnes réponses et points.",
      ),
      category: "quiz",
      source: "curated",
      settings: { isQuiz: true, showCorrectAnswers: "after-submission" },
      questions: [
        q("multiple-choice", l("What is the capital of France?", "Was ist die Hauptstadt von Frankreich?", "Quelle est la capitale de la France ?"), {
          required: true,
          points: 1,
          options: [paris, opt(l("London", "London", "Londres")), opt(l("Berlin", "Berlin", "Berlin"))],
          correctAnswers: [paris.id],
        }),
        q("short-answer", "2 + 2 = ?", { required: true, points: 1, correctAnswers: ["4"] }),
      ],
    },
    {
      id: "contact-form",
      name: l("Contact Form", "Kontaktformular", "Formulaire de contact"),
      description: l(
        "A simple name / email / message contact form.",
        "Ein einfaches Kontaktformular mit Name, E-Mail und Nachricht.",
        "Un formulaire de contact simple avec nom, e-mail et message.",
      ),
      category: "contact",
      source: "curated",
      questions: [
        q("short-answer", l("Name", "Name", "Nom"), { required: true }),
        q("short-answer", l("Email", "E-Mail", "E-mail"), { required: true }),
        q("short-answer", l("Message", "Nachricht", "Message"), { required: true }),
      ],
    },
  ];
}
