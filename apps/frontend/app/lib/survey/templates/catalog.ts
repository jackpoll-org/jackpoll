import type { Locale } from "@/app/i18n/translations";
import type { Option, Question, QuestionType } from "@/app/types/survey";
import type { SurveyTemplate } from "./types";

/** Curated, ship-with-the-product templates (issue #17), in the given locale. */
export function curatedTemplates(locale: Locale): SurveyTemplate[] {
  const de = locale === "de";
  const l = (en: string, german: string) => (de ? german : en);

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
      name: l("Event RSVP", "Event-Anmeldung"),
      description: l(
        "Collect attendance and guest counts for an event.",
        "Erfasse Zusagen und Gästezahlen für eine Veranstaltung.",
      ),
      category: "rsvp",
      source: "curated",
      questions: [
        q("short-answer", l("Your name", "Dein Name"), { required: true }),
        q("multiple-choice", l("Will you attend?", "Kommst du?"), {
          required: true,
          options: [
            opt(l("Yes", "Ja")),
            opt(l("No", "Nein")),
            opt(l("Maybe", "Vielleicht")),
          ],
        }),
        q("short-answer", l("Number of guests", "Anzahl der Gäste")),
        q("short-answer", l("Dietary requirements", "Ernährungswünsche")),
      ],
    },
    {
      id: "customer-feedback",
      name: l("Customer Feedback", "Kundenfeedback"),
      description: l(
        "Measure satisfaction and gather improvement ideas.",
        "Miss die Zufriedenheit und sammle Verbesserungsideen.",
      ),
      category: "feedback",
      source: "curated",
      questions: [
        q("multiple-choice", l("How satisfied are you?", "Wie zufrieden bist du?"), {
          required: true,
          options: [
            opt(l("Very satisfied", "Sehr zufrieden")),
            opt(l("Satisfied", "Zufrieden")),
            opt(l("Neutral", "Neutral")),
            opt(l("Dissatisfied", "Unzufrieden")),
          ],
        }),
        q("checkboxes", l("What did you like?", "Was hat dir gefallen?"), {
          options: [
            opt(l("Quality", "Qualität")),
            opt(l("Price", "Preis")),
            opt(l("Support", "Support")),
            opt(l("Speed", "Geschwindigkeit")),
          ],
        }),
        q("short-answer", l("Anything we can improve?", "Was können wir verbessern?")),
      ],
    },
    {
      id: "team-vote",
      name: l("Team Vote", "Team-Abstimmung"),
      description: l(
        "Let a team decide between options quickly.",
        "Lass ein Team schnell zwischen Optionen entscheiden.",
      ),
      category: "vote",
      source: "curated",
      questions: [
        q("multiple-choice", l("Pick your preferred option", "Wähle deine bevorzugte Option"), {
          required: true,
          options: [
            opt(l("Option A", "Option A")),
            opt(l("Option B", "Option B")),
            opt(l("Option C", "Option C")),
          ],
        }),
        q("short-answer", l("Why did you pick this?", "Warum hast du das gewählt?")),
      ],
    },
    {
      id: "quiz-round",
      name: l("Quiz Round", "Quizrunde"),
      description: l(
        "A scored quiz with correct answers and points.",
        "Ein bewertetes Quiz mit richtigen Antworten und Punkten.",
      ),
      category: "quiz",
      source: "curated",
      settings: { isQuiz: true, showCorrectAnswers: "after-submission" },
      questions: [
        q("multiple-choice", l("What is the capital of France?", "Was ist die Hauptstadt von Frankreich?"), {
          required: true,
          points: 1,
          options: [paris, opt(l("London", "London")), opt(l("Berlin", "Berlin"))],
          correctAnswers: [paris.id],
        }),
        q("short-answer", "2 + 2 = ?", { required: true, points: 1, correctAnswers: ["4"] }),
      ],
    },
    {
      id: "contact-form",
      name: l("Contact Form", "Kontaktformular"),
      description: l(
        "A simple name / email / message contact form.",
        "Ein einfaches Kontaktformular mit Name, E-Mail und Nachricht.",
      ),
      category: "contact",
      source: "curated",
      questions: [
        q("short-answer", l("Name", "Name"), { required: true }),
        q("short-answer", l("Email", "E-Mail"), { required: true }),
        q("short-answer", l("Message", "Nachricht"), { required: true }),
      ],
    },
  ];
}
