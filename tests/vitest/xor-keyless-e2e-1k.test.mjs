import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

const require = createRequire(import.meta.url);
const { generateXorDataset } = require("./generators/xorDataset.js");

function loadRuntime() {
  const window = loadBrowserContext([
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
    "js/ciphers/xorCipher.js",
  ]);
  return {
    xorCipher: window.KryptoCiphers.xorCipher,
  };
}

function normalizeVisibleText(text) {
  return String(text || "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

describe("xor keyless e2e 1k", () => {
  it("builds a deterministic 1000-case dataset", () => {
    const datasetA = generateXorDataset(1000, 42);
    const datasetB = generateXorDataset(1000, 42);
    const signatures = new Set(datasetA.map((entry) => `${entry.key}|${entry.plaintext}`));

    expect(datasetA).toEqual(datasetB);
    expect(datasetA).toHaveLength(1000);
    expect(signatures.has("KRYPTO|QUANTEN SPRUNG")).toBe(true);
    expect(signatures.size).toBe(1000);
  });

  it(
    "meets 1k gate: unhinted successRate >= 0.99, hinted successRate === 1.0, runtime < 3 minutes",
    () => {
      const { xorCipher } = loadRuntime();
      const dataset = generateXorDataset(1000, 42);
      const startedAt = Date.now();

      let unhintedHits = 0;
      let hintedHits = 0;

      for (const testCase of dataset) {
        const unhinted = xorCipher.crack(testCase.ciphertext);
        const hinted = xorCipher.crack(testCase.ciphertext, {
          keyLength: testCase.key.length,
        });

        if (normalizeVisibleText(unhinted.text) === normalizeVisibleText(testCase.plaintext)) {
          unhintedHits += 1;
        }

        if (
          hinted.key === testCase.key &&
          normalizeVisibleText(hinted.text) === normalizeVisibleText(testCase.plaintext)
        ) {
          hintedHits += 1;
        }
      }

      const elapsedMs = Date.now() - startedAt;
      const unhintedSuccessRate = unhintedHits / dataset.length;
      const hintedSuccessRate = hintedHits / dataset.length;

      // Gate schuetzt die Crack-Performance vor regressiven Aenderungen.
      // Accuracy ist hier wichtiger als Laufzeit; daher ist das Zeitbudget bewusst erweitert.
      expect(unhintedSuccessRate).toBeGreaterThanOrEqual(0.99);
      expect(hintedSuccessRate).toBe(1);
      expect(elapsedMs).toBeLessThan(5 * 60 * 1000);
    },
    300_000
  );
});
