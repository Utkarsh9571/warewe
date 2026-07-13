import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      reporter: ["text", "json", "html"],
    },
    // Inline these packages so Vitest can handle their ESM exports correctly
    server: {
      deps: {
        inline: [/@langchain/, /cheerio/, /rss-parser/],
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      // Stub server-only in test environment
      "server-only": resolve(__dirname, "./src/__mocks__/server-only.ts"),
    },
  },
});
