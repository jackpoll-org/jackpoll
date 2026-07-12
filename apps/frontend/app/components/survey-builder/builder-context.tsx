"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type {
  Question,
  QuestionType,
  Section,
  Survey,
  SurveySettings,
} from "@/app/types/survey";
import { builderReducer } from "./builder-reducer";
import { useAuthContext } from "@/app/components/auth/auth-provider";
import {
  CollabProvider,
  collabEnabled,
  colorFor,
  groupFocusByQuestion,
  resolveFollowTarget,
  type FocusState,
  type PresenceUser,
  type RemoteCaret,
  type TextTarget,
} from "@/app/lib/collab/provider";
import {
  applyContentToDoc,
  docHasContent,
  docToContent,
  toCollabContent,
} from "@/app/lib/collab/doc";

interface BuilderContextValue {
  survey: Survey;
  dirty: boolean;
  /** True only when this client has unsaved edits — drives autosave (#85). */
  locallyDirty: boolean;
  /** True once the collab doc has seeded; autosave waits for this to avoid
   *  firing during the initial sync settle. False when collab is disabled. */
  ready: boolean;
  /** Other people currently editing this survey (issue #85). */
  presence: PresenceUser[];
  /** Peers grouped by the question they're focused on (per-card highlight). */
  focusByQuestion: Map<string, PresenceUser[]>;
  /** Publish (or clear) which field this client is editing. */
  setFocus: (focus: FocusState | null) => void;
  /** The peer this client is following (auto-scrolls to their question), if any. */
  followingClientId: number | null;
  /** Follow a peer, or unfollow if already following them. */
  toggleFollow: (clientId: number) => void;
  // Live text carets (#85) — publish local caret, read remote ones.
  setCaret: (target: TextTarget, anchorIdx: number, headIdx: number) => void;
  clearCaret: () => void;
  caretsFor: (target: TextTarget) => RemoteCaret[];
  updateMeta: (
    patch: Partial<Pick<Survey, "title" | "description" | "status">>,
  ) => void;
  updateSettings: (patch: Partial<SurveySettings>) => void;
  /** Active page in the builder canvas — null = Page 1 (ungrouped). UI-only,
   *  not persisted and not shared over collab. */
  activePageId: string | null;
  setActivePageId: (sectionId: string | null) => void;
  addQuestion: (
    type: QuestionType,
    sectionId?: string | null,
    init?: Partial<Question>,
  ) => void;
  updateQuestion: (id: string, patch: Partial<Question>) => void;
  removeQuestion: (id: string) => void;
  moveQuestion: (id: string, direction: "up" | "down") => void;
  reorderQuestions: (activeId: string, overId: string) => void;
  addSection: (id?: string) => void;
  updateSection: (id: string, patch: Partial<Section>) => void;
  removeSection: (id: string) => void;
  moveSection: (id: string, direction: "up" | "down") => void;
  setQuestionSection: (questionId: string, sectionId: string | null) => void;
  // Multilingual content (issue #37)
  setLanguages: (languages: string[], defaultLanguage: string) => void;
  setTranslation: (locale: string, key: string, value: string) => void;
  markSaved: (survey: Survey) => void;
  /** True once a save was attempted with validation errors — drives the inline
   *  "required" highlighting on empty fields until they're filled. */
  attemptedSave: boolean;
  setAttemptedSave: (value: boolean) => void;
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

export function BuilderProvider({
  initialSurvey,
  children,
}: {
  initialSurvey: Survey;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(builderReducer, {
    survey: initialSurvey,
    dirty: false,
    locallyDirty: false,
  });

  // ── Live co-editing (issue #85) ──────────────────────────────────
  const { user } = useAuthContext();
  const providerRef = useRef<CollabProvider | null>(null);
  const readyRef = useRef(false);
  const surveyRef = useRef(state.survey);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [ready, setReady] = useState(false);
  const [followingClientId, setFollowingClientId] = useState<number | null>(null);
  useEffect(() => {
    surveyRef.current = state.survey;
  }, [state.survey]);

  // Create the provider once and bind the shared doc ⇄ reducer.
  useEffect(() => {
    if (!collabEnabled() || !user) return;
    const provider = new CollabProvider(initialSurvey.id, {
      name: user.name,
      color: colorFor(user.id || user.name),
    });
    providerRef.current = provider;
    const { doc } = provider;

    // Remote → reducer (our own local writes have origin null, so are skipped).
    const onUpdate = (_u: Uint8Array, origin: unknown) => {
      if (origin !== provider || !docHasContent(doc)) return;
      readyRef.current = true;
      setReady(true);
      dispatch({ type: "applyRemote", content: docToContent(doc) });
    };
    doc.on("update", onUpdate);

    const offPresence = provider.onPresenceChange(() =>
      setPresence(provider.presence()),
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPresence(provider.presence());

    // After a short sync settle: seed the doc if we're first, else adopt it.
    const seedTimer = setTimeout(() => {
      if (!docHasContent(doc)) {
        applyContentToDoc(doc, toCollabContent(surveyRef.current));
      } else if (!readyRef.current) {
        dispatch({ type: "applyRemote", content: docToContent(doc) });
      }
      readyRef.current = true;
      setReady(true);
    }, 800);

    return () => {
      clearTimeout(seedTimer);
      offPresence();
      doc.off("update", onUpdate);
      provider.destroy();
      providerRef.current = null;
      readyRef.current = false;
      setReady(false);
    };
  }, [initialSurvey.id, user]);

  // Local → doc: push edits once ready (setIfChanged makes echoes a no-op).
  useEffect(() => {
    const provider = providerRef.current;
    if (!provider || !readyRef.current) return;
    applyContentToDoc(provider.doc, toCollabContent(state.survey));
  }, [state.survey]);

  const updateMeta = useCallback<BuilderContextValue["updateMeta"]>(
    (patch) => dispatch({ type: "updateMeta", patch }),
    [],
  );
  const updateSettings = useCallback<BuilderContextValue["updateSettings"]>(
    (patch) => dispatch({ type: "updateSettings", patch }),
    [],
  );
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [attemptedSave, setAttemptedSave] = useState(false);

  // ── Follow location (issue #85) ──────────────────────────────────
  // Publish this client's builder page + current question so a follower tracks
  // every move — switching page, editing options/settings — not only titles.
  const activePageIdRef = useRef<string | null>(null);
  const lastQuestionRef = useRef<string | null>(null);
  useEffect(() => {
    activePageIdRef.current = activePageId;
  }, [activePageId]);
  const publishLocation = useCallback(() => {
    providerRef.current?.setLocation({
      pageId: activePageIdRef.current,
      questionId: lastQuestionRef.current,
    });
  }, []);
  // Re-publish whenever the active page changes so followers switch pages too.
  useEffect(() => {
    publishLocation();
  }, [activePageId, publishLocation]);

  // Follow mode: mirror the followed peer's page, then scroll to their question.
  useEffect(() => {
    if (followingClientId == null) return;
    const target = resolveFollowTarget(presence, followingClientId);
    if (!target) {
      // The followed peer left — stop following (syncing to external presence).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFollowingClientId(null);
      return;
    }
    // Switch to the peer's page first; this effect re-runs on the activePageId
    // change and then scrolls to their question once it's mounted.
    if ((target.pageId ?? null) !== (activePageId ?? null)) {
      setActivePageId(target.pageId ?? null);
      return;
    }
    if (target.questionId) {
      document
        .querySelector(`[data-question-id="${CSS.escape(target.questionId)}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [presence, followingClientId, activePageId]);
  const addQuestion = useCallback<BuilderContextValue["addQuestion"]>(
    (type, sectionId, init) =>
      dispatch({ type: "addQuestion", questionType: type, sectionId, init }),
    [],
  );
  const updateQuestion = useCallback<BuilderContextValue["updateQuestion"]>(
    (id, patch) => dispatch({ type: "updateQuestion", id, patch }),
    [],
  );
  const removeQuestion = useCallback(
    (id: string) => dispatch({ type: "removeQuestion", id }),
    [],
  );
  const moveQuestion = useCallback(
    (id: string, direction: "up" | "down") =>
      dispatch({ type: "moveQuestion", id, direction }),
    [],
  );
  const reorderQuestions = useCallback(
    (activeId: string, overId: string) =>
      dispatch({ type: "reorderQuestions", activeId, overId }),
    [],
  );
  const addSection = useCallback<BuilderContextValue["addSection"]>(
    (id) => dispatch({ type: "addSection", id }),
    [],
  );
  const updateSection = useCallback<BuilderContextValue["updateSection"]>(
    (id, patch) => dispatch({ type: "updateSection", id, patch }),
    [],
  );
  const removeSection = useCallback(
    (id: string) => dispatch({ type: "removeSection", id }),
    [],
  );
  const moveSection = useCallback(
    (id: string, direction: "up" | "down") =>
      dispatch({ type: "moveSection", id, direction }),
    [],
  );
  const setQuestionSection = useCallback<BuilderContextValue["setQuestionSection"]>(
    (questionId, sectionId) =>
      dispatch({ type: "setQuestionSection", questionId, sectionId }),
    [],
  );
  const setLanguages = useCallback<BuilderContextValue["setLanguages"]>(
    (languages, defaultLanguage) =>
      dispatch({ type: "setLanguages", languages, defaultLanguage }),
    [],
  );
  const setTranslation = useCallback<BuilderContextValue["setTranslation"]>(
    (locale, key, value) =>
      dispatch({ type: "setTranslation", locale, key, value }),
    [],
  );
  const markSaved = useCallback(
    (survey: Survey) => dispatch({ type: "saved", survey }),
    [],
  );
  const setFocus = useCallback<BuilderContextValue["setFocus"]>(
    (focus) => {
      providerRef.current?.setFocus(focus);
      // Track the question for follow: a question field sets it, a page-level
      // field clears it, a blur (null) keeps the last one.
      if (focus?.questionId) lastQuestionRef.current = focus.questionId;
      else if (focus?.sectionId) lastQuestionRef.current = null;
      publishLocation();
    },
    [publishLocation],
  );
  const focusByQuestion = useMemo(
    () => groupFocusByQuestion(presence),
    [presence],
  );
  const toggleFollow = useCallback<BuilderContextValue["toggleFollow"]>(
    (clientId) =>
      setFollowingClientId((cur) => (cur === clientId ? null : clientId)),
    [],
  );
  const setCaret = useCallback<BuilderContextValue["setCaret"]>(
    (target, anchorIdx, headIdx) =>
      providerRef.current?.setCaret(target, anchorIdx, headIdx),
    [],
  );
  const clearCaret = useCallback<BuilderContextValue["clearCaret"]>(
    () => providerRef.current?.clearCaret(),
    [],
  );
  const caretsFor = useCallback<BuilderContextValue["caretsFor"]>(
    (target) => providerRef.current?.caretsFor(target) ?? [],
    [],
  );

  const value = useMemo<BuilderContextValue>(
    () => ({
      survey: state.survey,
      dirty: state.dirty,
      locallyDirty: state.locallyDirty,
      ready,
      presence,
      focusByQuestion,
      setFocus,
      followingClientId,
      toggleFollow,
      setCaret,
      clearCaret,
      caretsFor,
      updateMeta,
      updateSettings,
      activePageId,
      setActivePageId,
      addQuestion,
      updateQuestion,
      removeQuestion,
      moveQuestion,
      reorderQuestions,
      addSection,
      updateSection,
      removeSection,
      moveSection,
      setQuestionSection,
      setLanguages,
      setTranslation,
      markSaved,
      attemptedSave,
      setAttemptedSave,
    }),
    [
      state.survey,
      state.dirty,
      state.locallyDirty,
      ready,
      presence,
      focusByQuestion,
      setFocus,
      followingClientId,
      toggleFollow,
      setCaret,
      clearCaret,
      caretsFor,
      updateMeta,
      updateSettings,
      activePageId,
      addQuestion,
      updateQuestion,
      removeQuestion,
      moveQuestion,
      reorderQuestions,
      addSection,
      updateSection,
      removeSection,
      moveSection,
      setQuestionSection,
      setLanguages,
      setTranslation,
      markSaved,
      attemptedSave,
    ],
  );

  return (
    <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>
  );
}

export function useBuilder(): BuilderContextValue {
  const ctx = useContext(BuilderContext);
  if (!ctx) {
    throw new Error("useBuilder must be used within <BuilderProvider>");
  }
  return ctx;
}
