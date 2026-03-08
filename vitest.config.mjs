import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Die Suite enthält mehrere lange CPU-Tests; ein etwas höherer Default verhindert,
    // dass Parallel-Last im Gesamtlauf kurze fachliche Regressionstests künstlich abwürgt.
    testTimeout: 30_000,
  },
});
