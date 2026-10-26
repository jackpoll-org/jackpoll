import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Node 25+ ships a global localStorage that hides jsdom's.
    execArgv: ["--no-experimental-webstorage"],
    include: ["app/**/*.{test,spec}.{ts,tsx}"],
    // Playwright E2E specs (e2e/**) run under Playwright, not Vitest.
    exclude: ["e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      include: ["app/**/*.{ts,tsx}"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
