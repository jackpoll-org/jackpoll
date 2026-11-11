import type { Option, Question, Survey } from "@/app/types/survey";
import { localizeSurvey, resolveContentLocale } from "@/app/lib/survey/content-i18n";
import { orderedQuestions } from "@/app/lib/survey/logic";

function OptionList({ options }: { options?: Option[] | null }) {
  if (!options?.length) return null;
  return (
    <ul className="list-disc pl-5">
      {options.map((option) => (
        <li key={option.id}>{option.label}</li>
      ))}
    </ul>
  );
}

function questionsInPlayerOrder(survey: Survey): Question[] {
  const flat = survey.settings.conversational || !survey.sections?.length;
  return flat ? survey.questions : orderedQuestions(survey);
}

export function SurveyNoscript({
  survey: source,
  locale,
  notice,
}: {
  survey: Survey | null;
  locale: string;
  notice: string;
}) {
  if (!source) return null;
  const survey = localizeSurvey(source, resolveContentLocale(source, locale));
  return (
    <noscript>
      <article className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <h1 className="text-2xl font-bold">{survey.title}</h1>
        {survey.description && <p>{survey.description}</p>}
        <ol className="list-decimal space-y-4 pl-5">
          {questionsInPlayerOrder(survey).map((question) => (
            <li key={question.id}>
              <h2 className="font-semibold">{question.title}</h2>
              {question.description && <p>{question.description}</p>}
              <OptionList options={question.options} />
              <OptionList options={question.rows} />
              <OptionList options={question.columns} />
            </li>
          ))}
        </ol>
        <p>{notice}</p>
      </article>
    </noscript>
  );
}
