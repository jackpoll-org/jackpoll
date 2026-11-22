import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { applyContentToDoc, docToContent, toCollabContent } from "../doc";
import type { Question, Survey } from "@/app/types/survey";
import {
  builderReducer,
  initialBuilderState,
  surveyToSave,
  type BuilderAction,
  type BuilderState,
} from "@/app/components/survey-builder/builder-reducer";

const REMOTE = "remote";

function choice(id: string, order: number): Question {
  return {
    id,
    type: "multiple-choice",
    title: id,
    required: false,
    order,
    options: [{ id: "a", label: "A" }],
    showInLiveResults: false,
    settings: { resultChart: "pie" },
  };
}

function serverSurvey(): Survey {
  return {
    id: "s1",
    ownerId: "owner",
    title: "Survey",
    status: "draft",
    settings: {
      allowMultipleResponses: false,
      showProgressBar: false,
      shuffleQuestions: false,
      isQuiz: false,
      showLiveResults: false,
      postSubmitSummary: false,
      showPoweredBy: false,
      rateLimit: false,
      onePerBrowser: false,
      requireCaptcha: false,
    },
    questions: [choice("q1", 0), choice("q2", 1)],
    createdAt: "",
    updatedAt: "",
  };
}

interface Builder {
  doc: Y.Doc;
  state: BuilderState;
}

function builder(survey: Survey): Builder {
  return { doc: new Y.Doc(), state: initialBuilderState(survey) };
}

function dispatch(b: Builder, action: BuilderAction): void {
  b.state = builderReducer(b.state, action);
  applyContentToDoc(b.doc, toCollabContent(b.state.survey));
}

function sync(builders: Builder[]): void {
  for (let round = 0; round < 3; round++) {
    for (const from of builders) {
      for (const to of builders) {
        if (from === to) continue;
        const update = Y.encodeStateAsUpdate(from.doc, Y.encodeStateVector(to.doc));
        let changed = false;
        const mark = () => (changed = true);
        to.doc.on("update", mark);
        Y.applyUpdate(to.doc, update, REMOTE);
        to.doc.off("update", mark);
        if (changed) dispatch(to, { type: "applyRemote", content: docToContent(to.doc) });
      }
    }
  }
}

const sharing = (q: Question | undefined) => ({
  showInLiveResults: q?.showInLiveResults,
  resultChart: q?.settings?.resultChart,
});
const find = (questions: Question[], id: string) => questions.find((q) => q.id === id);
const WIDE = { showInLiveResults: true, resultChart: "wordcloud" };
const NARROW = { showInLiveResults: false, resultChart: "pie" };

describe("result sharing across synced builders", () => {
  it("keeps the owner's widening in the doc and only withholds a link holder's", () => {
    const owner = builder(serverSurvey());
    const tab = builder(serverSurvey());
    const holder = builder(serverSurvey());
    applyContentToDoc(owner.doc, toCollabContent(owner.state.survey));
    sync([owner, tab, holder]);

    const widen = (b: Builder, id: string) =>
      dispatch(b, {
        type: "updateQuestion",
        id,
        patch: { showInLiveResults: true, settings: { ...find(b.state.survey.questions, id)?.settings, resultChart: "wordcloud" } },
      });

    widen(owner, "q1");
    sync([owner, tab, holder]);
    expect(sharing(find(tab.state.survey.questions, "q1"))).toEqual(WIDE);

    dispatch(tab, { type: "updateMeta", patch: { title: "Tab edit" } });
    const tabPayload = surveyToSave(tab.state);
    dispatch(tab, { type: "saved", survey: tabPayload });
    sync([owner, tab, holder]);

    expect(sharing(find(docToContent(owner.doc).questions, "q1"))).toEqual(WIDE);
    expect(sharing(find(owner.state.survey.questions, "q1"))).toEqual(WIDE);
    expect(owner.state.locallyDirty).toBe(true);
    const ownerPayload = surveyToSave(owner.state);
    expect(sharing(find(ownerPayload.questions, "q1"))).toEqual(WIDE);
    dispatch(owner, { type: "saved", survey: ownerPayload });
    sync([owner, tab, holder]);

    widen(holder, "q2");
    sync([owner, tab, holder]);
    expect(sharing(find(owner.state.survey.questions, "q2"))).toEqual(WIDE);
    dispatch(owner, { type: "updateMeta", patch: { title: "Unrelated" } });
    const payload = surveyToSave(owner.state);
    expect(payload.title).toBe("Unrelated");
    expect(sharing(find(payload.questions, "q2"))).toEqual(NARROW);
    expect(sharing(find(payload.questions, "q1"))).toEqual(WIDE);
    expect(sharing(find(docToContent(owner.doc).questions, "q2"))).toEqual(WIDE);
  });
});
