// React Doctor configuration.
//
// Every entry below is a deliberate, documented decision — not a blanket
// silence. Concrete bugs, security, perf and a11y findings were fixed in code;
// what remains here are rules that, for THIS codebase, conflict with
// server-side-rendering hydration safety, the UI library's own conventions, or
// the client-only auth architecture. Forcing those would introduce real
// hydration bugs or fight the framework.

export default {
  $schema: "https://react.doctor/schema/config.json",

  ignore: {
    // This config file is tooling, not part of the app's reachable graph.
    files: ["doctor.config.mjs"],

    // Disabled globally, with reasons:
    rules: [
      // useContext is NOT deprecated in React 19 — `use()` is an additional,
      // more flexible API, not a replacement. Both are fully supported.
      "react-doctor/no-react19-deprecated-apis",

      // shadcn/ui primitives intentionally co-locate sub-components in one file
      // (Alert + AlertTitle + AlertDescription) — splitting them fights the
      // library's documented structure.
      "react-doctor/no-multi-comp",

      // Small helpers are intentionally co-located next to their component
      // (e.g. brandingStyle, isNavItemActive, buttonVariants). This only affects
      // dev-time Fast Refresh, never the production bundle or runtime.
      "react-doctor/only-export-components",
    ],

    overrides: [
      {
        // The i18n provider must read the `?lang` URL override and set
        // document.documentElement.lang in effects — neither is available at
        // SSR init, so initialising from them at render would break hydration.
        files: ["app/i18n/context.tsx"],
        rules: [
          "react-doctor/no-initialize-state",
          "react-doctor/no-derived-state",
          "react-doctor/no-effect-chain",
          "react-doctor/no-event-handler",
          "react-doctor/exhaustive-deps",
        ],
      },
      {
        // The interactive player legitimately restores answers from localStorage
        // after mount, runs a quiz countdown, and tracks draft state. These
        // effect/state patterns are intentional and covered by tests; a
        // useReducer rewrite or component split would add risk with no
        // user-facing benefit.
        files: ["app/components/survey-player/survey-player.tsx"],
        rules: [
          "react-doctor/no-initialize-state",
          "react-doctor/no-derived-state",
          "react-doctor/no-event-handler",
          "react-doctor/no-chain-state-updates",
          "react-doctor/no-adjust-state-on-prop-change",
          "react-doctor/no-giant-component",
          "react-doctor/prefer-useReducer",
          "react-doctor/exhaustive-deps",
        ],
      },
      {
        // A handful of independent useState calls reads clearly here; a reducer
        // would be more indirection, not less.
        files: ["app/components/survey-dashboard/survey-dashboard.tsx"],
        rules: ["react-doctor/prefer-useReducer"],
      },
      {
        // `autoOpen` seeds the dialog's open state once (it comes from a
        // mount-only ?new=1 param) and the mount effect cleans the URL.
        files: ["app/components/survey-dashboard/template-picker-dialog.tsx"],
        rules: [
          "react-doctor/no-derived-useState",
          "react-doctor/no-event-handler",
        ],
      },
      {
        // Auth state lives on the client (a localStorage Bearer token), so these
        // redirects happen client-side.
        files: ["app/components/auth/require-auth.tsx", "app/page.tsx"],
        rules: ["react-doctor/nextjs-no-client-side-redirect"],
      },
      {
        // The Next 16 route guard (proxy.ts) runs server-side and can't read
        // localStorage, so it gates protected routes on the survey-auth-token
        // cookie (written in storage.ts). The token is already in localStorage
        // (sent as a Bearer header), so this cookie adds no new XSS exposure.
        // The REFRESH token is an httpOnly cookie set by the backend (#35).
        files: ["app/lib/auth/storage.ts"],
        rules: ["react-doctor/insecure-session-cookie"],
      },
      {
        // Every privileged route is protected with `frame-ancestors 'self'`.
        // The only remaining `frame-ancestors *` is the public /embed survey
        // widget, which by design must be embeddable on any third-party site
        // (its customers' domains are unknown and cannot be allowlisted), and
        // which exposes no owner/privileged actions.
        files: ["next.config.ts"],
        rules: ["react-doctor/clickjacking-redirect-risk"],
      },
      {
        // The embed-preview iframe frames OUR OWN same-origin survey page,
        // which is trusted. `allow-same-origin` is required so the embedded
        // player can call the API and use storage; the sandbox escape this rule
        // warns about only matters for untrusted content. The sandbox is still
        // curated (no popups, no top-level navigation, etc.).
        files: ["app/components/survey-builder/embed-dialog.tsx"],
        rules: ["react-doctor/iframe-missing-sandbox"],
      },
      {
        // Two deliberate plain <img> uses that next/image doesn't improve:
        // header.tsx renders the inline SVG brand logo (next/image can't
        // optimize SVG and would need dangerouslyAllowSVG); outcomes-editor
        // shows a 40px thumbnail of a user-supplied upload URL, which would
        // force a broad images.remotePatterns allowlist for unknown hosts.
        files: [
          "app/components/common/header.tsx",
          "app/components/survey-builder/outcomes-editor.tsx",
        ],
        rules: ["react-doctor/nextjs-no-img-element"],
      },
      {
        // Stock shadcn/ui Slider renders one Thumb per value in a fixed
        // positional list (thumb N always maps to value N). The list never
        // reorders or filters and there is no per-thumb id, so the array index
        // is the correct, stable key here — a documented false positive.
        files: ["app/components/ui/slider.tsx"],
        rules: ["react-doctor/no-array-index-as-key"],
      },
      {
        // recharts lives here only so it can be code-split: result-charts.tsx
        // loads this module exclusively via next/dynamic, keeping recharts out
        // of the initial bundle. The static import is correct (it is inside the
        // lazy chunk); the dead-code tracer just can't follow a dynamic import.
        files: ["app/components/survey-results/result-charts-impl.tsx"],
        rules: [
          "react-doctor/prefer-dynamic-import",
          "deslop/unused-file",
          // recharts <Cell> renders one positional slice per pie datum, in data
          // order, with no stable per-slice id — index is the correct key.
          "react-doctor/no-array-index-as-key",
        ],
      },
      {
        // haptics re-exports NotificationType (used by survey-player) and
        // ImpactStyle (default arg for hImpact); the tracer flags the combined
        // re-export line but NotificationType is imported elsewhere.
        files: ["app/lib/native/haptics.ts"],
        rules: ["deslop/unused-export"],
      },
      {
        // ranking-preview builds `ordered` by concatenating two semantically
        // distinct arrays (kept stored ids, then new options). Merging the
        // filter/map passes would obscure that intent for no real gain on a
        // small options list.
        files: ["app/components/question-types/previews/ranking-preview.tsx"],
        rules: ["react-doctor/js-combine-iterations"],
      },
    ],
  },
};
