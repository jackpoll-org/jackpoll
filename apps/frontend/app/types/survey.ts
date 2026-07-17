// ── Survey domain types ────────────────────────────────────────────
//
// Mirrors the backend DTOs in
// survey-backend/src/main/java/org/acme/dto/SurveyDtos.java. Field names are
// kept identical to avoid mapping drift.

export type QuestionType =
  | "short-answer"
  | "multiple-choice"
  | "checkboxes"
  | "dropdown"
  | "multiple-choice-grid"
  | "checkbox-grid"
  | "file-upload"
  | "slider"
  | "rating"
  | "date"
  | "ranking"
  | "rating-grid"
  | "signature"
  | "wordcloud";

export type SurveyStatus = "draft" | "published" | "closed";

/** A choice option, or a grid row/column label. */
export interface Option {
  id: string;
  label: string;
  /** Optional response quota for single-select choices (#38); null = unlimited. */
  capacity?: number | null;
  /** Server-maintained reservation counter (#38); read-only on the client. */
  used?: number | null;
}

/** A file stored in object storage (MinIO), referenced by an answer. */
export interface UploadedFile {
  key: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
}

export type ValidationRuleType =
  | "minLength"
  | "maxLength"
  | "pattern"
  | "minSelected"
  | "maxSelected";

export type LogicOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "notContains"
  | "empty"
  | "notEmpty"
  | "greaterThan"
  | "lessThan";

/** A single condition referencing an earlier question's answer (issue #6). */
export interface LogicCondition {
  questionId: string;
  operator: LogicOperator;
  /** Compared value (option id for choices, raw text/number otherwise). */
  value?: string;
}

/**
 * Conditional-visibility rule: the question is shown only when its conditions
 * match (combined with `all` = AND or `any` = OR).
 */
export interface LogicRule {
  match: "all" | "any";
  conditions: LogicCondition[];
}

/** A single answer-validation rule attached to a question (issue #4). */
export interface ValidationRule {
  type: ValidationRuleType;
  /** Numeric bound for length/selection rules. */
  value?: number;
  /** Regex source for `pattern` rules. */
  pattern?: string;
  /** Optional custom error message shown to the respondent. */
  message?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  order: number;
  /** Choice options (multiple-choice, checkboxes, dropdown). */
  options?: Option[] | null;
  /** Grid rows (multiple-choice-grid, checkbox-grid). */
  rows?: Option[] | null;
  /** Grid columns (multiple-choice-grid, checkbox-grid). */
  columns?: Option[] | null;
  /** Type-specific config (forward-compat for validation/logic). */
  settings?: Record<string, unknown> | null;
  /** Quiz mode (issue #10) — unused in milestone 1. */
  points?: number | null;
  correctAnswers?: string[] | null;
  /** Case-sensitive grading for short-answer quiz questions; default false. */
  caseSensitiveAnswers?: boolean | null;
  /** Per-question live-results override (issue #21); null = type default. */
  showInLiveResults?: boolean | null;
  /** Owning section for multi-page surveys (issue #28); null = flat/ungrouped. */
  sectionId?: string | null;
}

/** A page that groups ordered questions in a multi-page survey (issue #28). */
export interface Section {
  id: string;
  title?: string;
  description?: string;
  order: number;
  /** Optional conditional-visibility rule (extends issue #6). */
  visibleIf?: LogicRule | null;
}

export interface SurveySettings {
  allowMultipleResponses: boolean;
  confirmationMessage?: string;
  redirectUrl?: string;
  showProgressBar: boolean;
  shuffleQuestions: boolean;
  // Quiz mode (issue #10) — forward-compat, unused in milestone 1
  isQuiz: boolean;
  timeLimit?: number;
  passingScore?: number;
  showCorrectAnswers?: "immediately" | "after-submission" | "never";
  /** Optional ISO instant before which the survey is not yet open (issue #39). */
  opensAt?: string;
  /** Optional ISO instant after which the survey stops accepting responses. */
  closesAt?: string;
  /** Optional max responses; 0 / unset means unlimited (issue #19). */
  responseLimit?: number;
  // Live results (issue #21) — default off.
  showLiveResults: boolean;
  postSubmitSummary: boolean;
  // Branding (issue #30) — shown on public pages.
  accentColor?: string;
  /** Custom page background colour respondents see (any CSS colour). */
  backgroundColor?: string;
  logoUrl?: string;
  headerImageUrl?: string;
  showPoweredBy: boolean;
  // Spam & bot protection (issue #31) — opt-in, safe defaults off.
  minSubmitSeconds?: number;
  rateLimit: boolean;
  onePerBrowser: boolean;
  requireCaptcha: boolean;
  // Email notifications (issue #24) — default off.
  ownerNotify?: "off" | "each" | "daily";
  respondentReceipts?: boolean;
  // Edit after submission (issue #40) — default off.
  allowEditResponses?: boolean;
  // Conversational layout (issue #82) — one question per screen.
  conversational?: boolean;
  // First-page heading (issue #94 follow-up). Page 1 is the implicit ungrouped
  // bucket (no Section), so its optional title/description live on settings.
  firstPageTitle?: string;
  firstPageDescription?: string;
  // Score-based outcome pages (issue #83) — quiz result screens.
  outcomes?: Outcome[];
  // Data retention (issue #64) — auto-delete/anonymise responses older than
  // retentionDays; undefined/0 = keep indefinitely.
  retentionDays?: number;
  retentionAnonymize?: boolean;
  // Respondent privacy notice & legal basis (issue #63).
  privacyNotice?: string;
  requireConsent?: boolean;
  /** Require each respondent to enter their name (stored + shown in results). */
  requireRespondentName?: boolean;
  /** Presenter-paced live mode: host drives the questions one at a time (#). */
  liveMode?: boolean;
  /** Live quiz per-question countdown in seconds (faster = more points, #). */
  liveQuestionSeconds?: number | null;
  /** Custom chart color palette (CSS colors, in cycle order); unset = theme default. */
  colorPalette?: string[] | null;
}

/** A score-based outcome / result page shown after a quiz submit (issue #83). */
export interface Outcome {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  minScore?: number;
  maxScore?: number;
}

export interface Folder {
  id: string;
  name: string;
}

/** Account-level notification preferences (issue #89). */
export interface NotificationPreferences {
  newResponse: {
    email: boolean;
    mobilePush: boolean;
    webPush: boolean;
  };
  dailyDigest: {
    email: boolean;
  };
}

export interface Survey {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  status: SurveyStatus;
  settings: SurveySettings;
  questions: Question[];
  // Multi-page surveys (issue #28)
  sections?: Section[];
  // Organization (issue #33)
  tags?: string[];
  folderId?: string | null;
  /** Manual drag-reorder index within the folder/root view (issue #94). */
  sortPosition?: number | null;
  // Multilingual content (issue #37)
  /** Enabled content locales; empty/undefined = single-language survey. */
  languages?: string[];
  /** Canonical locale the survey was authored in. */
  defaultLanguage?: string;
  /** Per-locale translation bag: locale → (fieldKey → translated text). */
  i18n?: SurveyI18n;
  createdAt: string;
  updatedAt: string;
}

/** locale → (stable field key → translated text) — see content-i18n helpers. */
export type SurveyI18n = Record<string, Record<string, string>>;

// ── Request payloads ───────────────────────────────────────────────

export interface CreateSurveyRequest {
  title: string;
  description?: string;
}

export interface UpdateSurveyRequest {
  title: string;
  description?: string;
  status: SurveyStatus;
  settings?: SurveySettings;
  questions: Question[];
  sections?: Section[];
  // Multilingual content (issue #37)
  languages?: string[];
  defaultLanguage?: string;
  i18n?: SurveyI18n;
}

// ── Webhooks (issue #36) ───────────────────────────────────────────

export interface Webhook {
  id: string;
  url: string;
  enabled: boolean;
  /** HMAC signing secret — configure your receiver to verify X-Survey-Signature. */
  secret: string;
  lastStatus?: number | null;
  lastError?: string | null;
  lastDeliveryAt?: string | null;
  createdAt: string;
}

export interface CreateWebhookRequest {
  url: string;
  enabled: boolean;
}

export interface WebhookTestResult {
  delivered: boolean;
  status?: number | null;
  error?: string | null;
}

// ── Collaboration (issue #8) ───────────────────────────────────────

export type CollaboratorRole = "editor" | "viewer";

export type CollaboratorStatus = "PENDING" | "ACCEPTED";

export interface Collaborator {
  userId: string;
  email: string | null;
  name: string | null;
  role: CollaboratorRole;
  status: CollaboratorStatus;
}

export interface AddCollaboratorRequest {
  email: string;
  role: CollaboratorRole;
}

/** A pending collaboration invitation shown to the invitee (#8). */
export interface Invitation {
  surveyId: string;
  surveyTitle: string;
  ownerName: string | null;
  role: CollaboratorRole;
}

/** Passwordless editing link (issue #22). */
export interface CollabLink {
  slug: string;
  expiresAt?: string | null;
}

// ── Shareable link (issue #16) ─────────────────────────────────────

export interface ShareLink {
  slug: string;
  expiresAt?: string | null;
  maxResponses?: number | null;
  responseCount: number;
}

export interface UpdateShareLinkRequest {
  expiresAt?: string | null;
  maxResponses?: number | null;
}

// ── Access code (issue #15) ────────────────────────────────────────

export interface AccessCode {
  code: string;
  requireCode: boolean;
  lastRotatedAt: string;
}

// ── Responses & results (issue #12) ────────────────────────────────

export interface AnswerInput {
  questionId: string;
  value: unknown;
}

export interface SubmitResponseRequest {
  durationMs?: number;
  answers: AnswerInput[];
  // Spam & bot protection (issue #31) — advisory client hints.
  honeypot?: string;
  beginToken?: string;
  clientId?: string;
  captcha?: string;
  /** Opt-in respondent email for a receipt (issue #24). */
  respondentEmail?: string;
  /** True for a builder preview/test submission — excluded from results. */
  preview?: boolean;
  /** Respondent's name when the survey requires it (#). */
  respondentName?: string;
}

// ── Save & Resume drafts (issue #26) ───────────────────────────────

export interface SaveDraftRequest {
  /** Present when updating an existing draft; omit on first save. */
  token?: string;
  answers: AnswerInput[];
  /** Best-effort current position (e.g. last answered index). */
  position?: number;
}

export interface DraftDto {
  token: string;
  surveyId: string;
  answers: AnswerInput[];
  position?: number | null;
  expiresAt: string;
}

export interface SurveyResponseDto {
  id: string;
  submittedAt: string;
  durationMs?: number | null;
  // Quiz mode (issue #10)
  score?: number | null;
  maxScore?: number | null;
  passed?: boolean | null;
  answers: AnswerInput[];
  // Edit after submission (issue #40)
  editToken?: string | null;
  editedAt?: string | null;
  /** Respondent's name when the survey required it (#); null otherwise. */
  respondentName?: string | null;
}

/** Data to re-open a response for editing (issue #40). */
export interface ResponseEditView {
  surveyId: string;
  response: SurveyResponseDto;
}

export interface QuizStats {
  maxScore: number;
  passingScore?: number | null;
  averageScore: number;
  passedCount: number;
  failedCount: number;
  distribution: { score: number; count: number }[];
}

export interface RowResult {
  rowId: string;
  columnCounts: Record<string, number>;
}

export interface QuestionResult {
  questionId: string;
  type: QuestionType;
  title: string;
  answered: number;
  /** Choice/dropdown/checkboxes: optionId → count. */
  optionCounts?: Record<string, number> | null;
  /** Grid types: per-row column counts. */
  rows?: RowResult[] | null;
  /** Short answer: collected free-text values. */
  textAnswers?: string[] | null;
  /** File upload: uploaded file references. */
  files?: { key: string; url: string; filename: string }[] | null;
  /** Slider (#55): mean / median of the numeric answers. */
  average?: number | null;
  median?: number | null;
}

export interface SurveyResults {
  surveyId: string;
  title: string;
  totalResponses: number;
  lastResponseAt?: string | null;
  /** Mean respondent completion time in ms; null when no timed responses. */
  avgDurationMs?: number | null;
  questions: QuestionResult[];
  /** Present only for quiz surveys (issue #10). */
  quiz?: QuizStats | null;
}

// ── Analytics (issue #34) ──────────────────────────────────────────

export interface CountEntry {
  key: string;
  count: number;
}

export interface SurveyAnalytics {
  views: number;
  starts: number;
  submits: number;
  sources: CountEntry[];
  channels: CountEntry[];
  devices: CountEntry[];
  daily: CountEntry[];
}
