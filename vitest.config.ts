import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 180_000,
    hookTimeout: 180_000,
    exclude: ["node_modules", "dist", "example"],
  },
});
