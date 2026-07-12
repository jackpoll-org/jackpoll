import type { Option, Question, QuestionType } from "@/app/types/survey";
import type { SurveyTemplate } from "./types";

// Local id counter — template ids are placeholders, regenerated on use.
let counter = 0;
const uid = () => `tpl-${counter++}`;

function opt(label: string): Option {
  return { id: uid(), label };
}

function q(
  type: QuestionType,
  title: string,
  extra: Partial<Question> = {},
): Question {
  return { id: uid(), type, title, required: false, order: 0, ...extra };
}

/** Curated, ship-with-the-product templates (issue #17). */
export const CURATED_TEMPLATES: SurveyTemplate[] = [
  {
    id: "event-rsvp",
    name: "Event RSVP",
    description: "Collect attendance and guest counts for an event.",
    category: "rsvp",
    source: "curated",
    questions: [
      q("short-answer", "Your name", { required: true }),
      q("multiple-choice", "Will you attend?", {
        required: true,
        options: [opt("Yes"), opt("No"), opt("Maybe")],
      }),
      q("short-answer", "Number of guests"),
      q("short-answer", "Dietary requirements"),
    ],
  },
  {
    id: "customer-feedback",
    name: "Customer Feedback",
    description: "Measure satisfaction and gather improvement ideas.",
    category: "feedback",
    source: "curated",
    questions: [
      q("multiple-choice", "How satisfied are you?", {
        required: true,
        options: [
          opt("Very satisfied"),
          opt("Satisfied"),
          opt("Neutral"),
          opt("Dissatisfied"),
        ],
      }),
      q("checkboxes", "What did you like?", {
        options: [opt("Quality"), opt("Price"), opt("Support"), opt("Speed")],
      }),
      q("short-answer", "Anything we can improve?"),
    ],
  },
  {
    id: "team-vote",
    name: "Team Vote",
    description: "Let a team decide between options quickly.",
    category: "vote",
    source: "curated",
    questions: [
      q("multiple-choice", "Pick your preferred option", {
        required: true,
        options: [opt("Option A"), opt("Option B"), opt("Option C")],
      }),
      q("short-answer", "Why did you pick this?"),
    ],
  },
  {
    id: "quiz-round",
    name: "Quiz Round",
    description: "A scored quiz with correct answers and points.",
    category: "quiz",
    source: "curated",
    settings: { isQuiz: true, showCorrectAnswers: "after-submission" },
    questions: [
      q("multiple-choice", "What is the capital of France?", {
        required: true,
        points: 1,
        options: [opt("Paris"), opt("London"), opt("Berlin")],
        // correctAnswers filled below to reference the generated option id
      }),
      q("short-answer", "2 + 2 = ?", { required: true, points: 1 }),
    ],
  },
  {
    id: "contact-form",
    name: "Contact Form",
    description: "A simple name / email / message contact form.",
    category: "contact",
    source: "curated",
    questions: [
      q("short-answer", "Name", { required: true }),
      q("short-answer", "Email", { required: true }),
      q("short-answer", "Message", { required: true }),
    ],
  },
];

// Wire up the quiz template's correct answers to its generated option ids.
const quiz = CURATED_TEMPLATES.find((t) => t.id === "quiz-round");
if (quiz) {
  const mc = quiz.questions[0];
  mc.correctAnswers = [mc.options![0].id]; // "Paris"
  quiz.questions[1].correctAnswers = ["4"];
}
