import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    testTimeout: 20_000,
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: { include: /styles\.css/ },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
