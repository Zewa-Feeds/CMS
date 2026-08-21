/**
 * Test runner for the CMS.
 *
 * Scoped deliberately: the authentication redirect logic is what earns tests
 * here, because it is the one part of this app whose failure locks a user out
 * of it entirely — and it did, silently, until a stale cookie was cleared by
 * hand. The rest of the CMS is forms and tables, where a snapshot proves a
 * component changed rather than that it broke.
 *
 * jsdom because the middleware and store both read `document.cookie`, and the
 * bug lived precisely in who writes and clears it.
 */
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  // Next configures the automatic JSX runtime in its own build; a bare vitest
  // run does not inherit that, and the classic runtime fails on files that
  // correctly never import React.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    include: ["{lib,app,components,.}/**/*.test.{js,jsx}"],
    globals: true,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
