import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": import.meta.dirname } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Each test file opens its own in-memory DB; no shared state to isolate.
    pool: "threads",
  },
});
