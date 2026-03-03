import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    testcontainers: "src/testcontainers.ts",
  },
  format: "esm",
  dts: true,
  fixedExtension: false,
  deps: {
    neverBundle: ["testcontainers"],
  },
});
