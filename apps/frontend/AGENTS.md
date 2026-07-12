<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project: Jackpoll (survey-frontend)

A Google Forms-like survey/quiz builder built with Next.js 16, React 19, and Tailwind CSS v4.

## Tech Stack

- **Framework:** Next.js 16.2.6 (App Router)
- **UI Library:** React 19.2.4
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`)
- **Language:** TypeScript 5 (strict mode)
- **Linting:** ESLint 9 + `eslint-config-next`
- **Fonts:** Geist Sans + Geist Mono (via `next/font/google`)
- **Path Aliases:** `@/*` maps to project root
- **UI Library:** shadcn/ui (mandatory — always reuse shadcn components, never build custom primitives)

## UI Components (shadcn/ui)

- **ALL UI components live in `app/components/ui/`** — this is the single source of truth for every Button, Input, Card, Dialog, Select, Tabs, Table, Dropdown Menu, and every other UI primitive. Every component here is the **stock shadcn/ui component (MIT-licensed)** or our own extension of one.
- **NEVER create custom UI primitives** in the main project — if a component does not exist in `app/components/ui/`, add it from the **official shadcn/ui registry (MIT)** at [ui.shadcn.com](https://ui.shadcn.com) via `npx shadcn@latest add <component>`, then move it into `app/components/ui/` and fix its imports to use `@/app/components/ui/` and `@/lib/utils`. Check that any sub-dependencies (other UI components it imports) also exist in `app/components/ui/` — add those first.
- **Only use MIT-licensed sources.** This repo is open-source (MIT). NEVER copy component/theme code from any paid, closed-source, or "for closed-source projects only" kit or template into this repo. When in doubt about a source's license, don't use it.
- **Import pattern:** `import { Button } from "@/app/components/ui/button"`
- **The theme system MUST work with the theme changer** — all components must use theme-aware CSS variables (e.g., `bg-primary`, `text-foreground`) not hardcoded colors.

## Architecture

### Component Conventions
- Use **Server Components by default** — only mark with `'use client'` when using:
  - `useState`, `useEffect`, `useReducer`, or other client hooks
  - Browser APIs (`window`, `document`, `localStorage`)
  - Event handlers that need closure state
- Extract shared UI primitives into `app/components/ui/`
- Extract feature-specific components into `app/components/[feature]/`
- Keep components under 200 lines; split into sub-components when larger

### Directory Structure

```
app/
├── components/
│   ├── ui/              # Shared primitive components (Button, Input, Card, etc.)
│   ├── auth/            # Authentication components (login, register, etc.)
│   ├── common/          # Layout, navigation, header, footer
│   ├── theme-customizer/ # Theme panel and selectors
│   ├── survey-dashboard/ # Survey list, cards, create dialog
│   ├── survey-builder/  # Survey creation/editing components (reducer, context, header)
│   ├── survey-player/   # Survey response/fill-out components (planned)
│   └── question-types/  # Question type editors + preview renderers + registry
├── hooks/               # Shared custom hooks
├── lib/                 # Utilities, validators, helpers
│   ├── auth/            # Auth API, schemas, constants
│   └── survey/          # Survey API, schemas, constants
├── types/               # Global TypeScript types and interfaces
├── i18n/                # Translations and i18n utilities (planned)
├── api/                 # API route handlers (App Router route handlers, planned)
├── (routes)/            # Route groups for page organization
│   └── (auth)/          # Auth pages (login, register, forgot-password, etc.)
├── layout.tsx
├── page.tsx
├── globals.css
└── themes.css
public/
├── images/
└── locales/             # Static locale assets if needed (planned)
```

Directories marked **(planned)** do not exist yet — create them when implementing the corresponding feature.

## Tailwind CSS v4 Notes

- No `tailwind.config.js` — configuration lives in CSS via `@theme` and `@import "tailwindcss"`
- Custom theme extensions go in `app/globals.css` using `@theme` blocks
- The `dark:` variant works automatically via `class` strategy on `<html>`
- Font variables (`--font-geist-sans`, `--font-geist-mono`) are injected by `next/font` and referenced in Tailwind via `font-sans` and `font-mono`

### Theme System (CRITICAL)

The project uses a dynamic theme system with 9 presets (Default, Jackpoll, Midnight, Ember, Meadow, Blossom, Harbor, Dusk, Sand) plus dark mode. All preset palettes are self-authored (oklch scales) — see `app/themes.css`.

**Architecture:**
- `app/globals.css` — `@theme inline` block defines `--color-*` → `var(--*)` mappings for Tailwind utility generation
- `app/themes.css` — Theme presets via `[data-theme-preset]` selectors + `body` rule with `--color-*` mappings
- `app/components/active-theme.tsx` — Client component that sets `data-theme-preset`, `data-theme-radius`, `data-theme-scale` on `<body>` and cookies
- `app/layout.tsx` — Server-side cookie reading for initial theme rendering (no flash)

**CRITICAL: `@theme inline` + body `--color-*` mapping pattern:**
- Tailwind v4's `@theme` block generates `:root` CSS custom property declarations. If `--color-primary: var(--primary)` is on `:root`, it resolves `var(--primary)` using the `:root` value — NOT the `<body>` override from theme presets.
- Therefore we use `@theme inline` (generates utility classes but NOT `:root` declarations) and define `--color-*` mappings on `<body>` in `themes.css`, so they resolve against the same element where theme presets override `--primary`, `--background`, etc.
- **NEVER change `@theme inline` to `@theme`** — this will break theme switching.
- **NEVER add `--color-*` mappings to `:root`** — they must stay on `<body>`.
- When adding new theme-aware colors, add both the `--my-color` token in `:root`/`.dark`/`[data-theme-preset]` AND the `--color-my-color: var(--my-color)` mapping in the `body` rule in `themes.css`.

## Domain Model

The core entities agents should be familiar with. These are reference models — create corresponding TypeScript interfaces in `app/types/` when implementing the features that use them. `ValidationRule` and `LogicRule` types are TBD — define them when implementing features #4 and #6.

### Survey
```typescript
interface Survey {
  id: string
  title: string
  description?: string
  createdAt: Date
  updatedAt: Date
  status: 'draft' | 'published' | 'closed'
  settings: SurveySettings
  questions: Question[]
}
```

### Question
```typescript
interface Question {
  id: string
  type: QuestionType
  title: string
  description?: string
  required: boolean
  options?: Option[]        // For choice-based types
  validation?: ValidationRule[]
  conditionalLogic?: LogicRule[]
  points?: number           // For quiz mode
  correctAnswers?: string[] // For quiz mode
  order: number
}

type QuestionType =
  | 'short-answer'
  | 'multiple-choice'
  | 'checkboxes'
  | 'dropdown'
  | 'multiple-choice-grid'
  | 'checkbox-grid'
  | 'file-upload'

interface Option {
  id: string
  label: string
}
```

### Survey Settings
```typescript
interface SurveySettings {
  allowMultipleResponses: boolean
  confirmationMessage?: string
  redirectUrl?: string
  showProgressBar: boolean
  shuffleQuestions: boolean
  theme?: 'light' | 'dark' | 'auto'
  // Quiz mode
  isQuiz: boolean
  timeLimit?: number        // In seconds
  passingScore?: number
  showCorrectAnswers: 'immediately' | 'after-submission' | 'never'
}
```

## Backend API (survey-backend)

- **MANDATORY: Always check the `survey-backend` project** (`../backend/`) before implementing any API call to confirm the correct endpoints, request/response shapes, and HTTP methods.
- Do not assume REST conventions — read the backend source (controllers, routes, DTOs) to match the actual contract.
- If the backend endpoint does not yet exist, create a corresponding backend task before wiring the frontend to a non-existent endpoint.
- **NEVER hardcode API URLs or guess endpoint paths** — always verify against the actual backend source code.
- Backend API base URL is configured via `NEXT_PUBLIC_API_URL` env var (defaults to `http://localhost:8080`). Use the `API_BASE_URL` constant from `@/app/lib/auth/constants`.
- If `../backend/` is not accessible, check for API documentation in this repo's `docs/` folder, or ask the user for the API contract.

## No Mock Data

- **NEVER use mock data, hardcoded placeholder data, or fake API responses** in any component, hook, or page.
- Every piece of data displayed in the UI MUST come from the real backend API via TanStack Query hooks.
- If a backend endpoint does not exist yet, do NOT create a frontend that pretends it does. Instead:
  1. Create the backend endpoint first (or file a GitHub issue in `survey-backend` describing the needed endpoint).
  2. Then wire the frontend to the real endpoint.
- **NEVER use `useState` with hardcoded arrays/objects** as a substitute for API data. If data is needed, fetch it from the backend.
- The only exception is truly static content (e.g., navigation labels, feature descriptions) that never comes from an API.
- **This rule applies to production code only.** Test files may (and should) use mock data and mocked TanStack Query hooks for isolation.

## State Management Guidelines

- **Server state** (surveys, responses): Use **TanStack Query** (`@tanstack/react-query`) for all data fetching, caching, and background updates.
  - For initial page loads in Server Components, use `async/await` + direct `fetch` to the backend API.
  - For interactive/client-side data (mutations, background refresh, optimistic updates), use Client Components with TanStack Query hooks (`useQuery`, `useMutation`).
- **Client state** (builder UI, drag-and-drop, form drafts): Use `useState` + `useReducer` for local state. Lift shared builder state to a React Context if multiple components need access.
- **No Redux/Zustand** unless explicitly requested — prefer built-in React patterns + TanStack Query first.

## Data Validation

- Use **Zod** for all runtime validation (install when needed)
- Infer TypeScript types from Zod schemas using `z.infer<typeof schema>`
- Validate on both client (for UX) and server (for security)

## Feature Modules

Major features tracked in GitHub issues — align implementation with these scopes:

1. **Question Types** (#2) — Renderers for all 6+ question types in builder + player
2. **File Upload** (#3) — Image upload with drag-and-drop, preview, size limits
3. **Answer Validation** (#4) — Real-time validation rules per question type
4. **Drag & Drop** (#5) — Reorder questions using `@dnd-kit/core` or `@hello-pangea/dnd`
5. **Conditional Logic** (#6) — Branching rules: show/hide or go-to-section based on answers
6. **Survey Embedding** (#7) — Dedicated `/embed/[id]` route, iframe-friendly
7. **Collaboration** (#8) — Role-based access (owner/editor/viewer)
8. **Custom Confirmation** (#9) — Editable post-submission message + redirect
9. **Quiz Mode** (#10) — Correct answers, points, timer, auto-submit, results

## API Patterns

- Use **TanStack Query** for all backend communication — queries for fetching, mutations for creating/updating/deleting.
- **All browser-side API calls go through the Next.js API proxy** at `/api/*` to avoid CORS issues. The proxy is defined in `app/api/[...path]/route.ts` and forwards requests to the Quarkus backend.
- Use **Next.js Route Handlers** (`app/api/.../route.ts`) only when a proxy layer is needed (e.g., for auth, file upload presigning, or CORS).
- Use the `ApiResponse<T>` type from `@/app/types/auth` for consistent API responses. For paginated responses, extend with `meta: { total: number; page: number; limit: number }`.
- Prefer direct `fetch` to `survey-backend` inside TanStack Query hooks rather than Server Actions for data fetching.
- Use Server Actions (`'use server'`) only for mutations that need server-side validation or secrets.

## i18n

- The app targets German and English
- Store translations in `app/i18n/translations.ts` or similar structured file
- Use a simple `useTranslation()` hook or context; avoid heavy i18n libraries unless needed
- Default language: German

## Styling Rules

- Utility-first with Tailwind — avoid arbitrary values when standard utilities exist
- Use `cn()` helper (from `clsx` + `tailwind-merge`) for conditional classes
- Support `dark:` variants for all custom UI components
- Keep colors in the neutral/zinc palette unless branding demands otherwise

## Performance

- Server Components for data-heavy pages
- `next/image` for all images (handles optimization automatically)
- Lazy load heavy question type components with `dynamic()`
- Debounce rapid state changes (e.g., live preview, search)

## Security

- Never hardcode secrets — use `process.env.*` with runtime validation
- Sanitize user-generated content (question titles, confirmation messages) to prevent XSS
- Validate file uploads: whitelist extensions, enforce max size, scan if possible
- Rate-limit API routes and public endpoints
- Use CSP headers for embed routes

## Testing Requirements

- **Every feature must include test files** that verify the frontend works correctly, including API calls.
- Use **Vitest** for unit tests and **Playwright** for E2E tests.
- Mock TanStack Query hooks in unit tests where needed, but verify real API integration in E2E tests.
- Minimum test coverage: 80%.

## Agent Workflow

When implementing features:
1. Check the relevant GitHub issue for acceptance criteria
2. Check `../backend/` for the exact API contract before writing any frontend fetch/mutation code
3. Create/update types in `app/types/` first
4. Build UI components in `app/components/[feature]/` using shadcn/ui primitives from `@/app/components/ui/`
5. Add TanStack Query hooks for all backend communication
6. Write tests (unit + E2E, including API call verification) before marking complete
7. Update this doc when: adding a new directory convention, changing the import pattern, switching state management approach, or modifying the theme system architecture
