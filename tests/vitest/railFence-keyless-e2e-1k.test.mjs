import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

const require = createRequire(import.meta.url);
const { generateRailFenceDataset } = require("./generators/railFenceDataset.js");

function loadRuntime() {
  const window = loadBrowserContext([
    "js/ciphers/railFenceCipher.js",
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
  ]);
  return {
    railFence: window.KryptoCiphers.railFenceCipher,
  };
}

function normalizeVisibleText(text) {
  return String(text || "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

describe("rail fence keyless e2e 1k", () => {
  it("builds a deterministic 1000-case dataset", () => {
    const datasetA = generateRailFenceDataset(1000, 42);
    const datasetB = generateRailFenceDataset(1000, 42);
    const signatures = new Set(datasetA.map((entry) => `${entry.key}|${entry.plaintext}`));

    expect(datasetA).toEqual(datasetB);
    expect(datasetA).toHaveLength(1000);
    expect(signatures.has("3|POTENTIALTOPFMODELL")).toBe(true);
    expect(signatures.has("4|VERSCHRAENKTE TEILCHEN")).toBe(true);
    expect(signatures.has("5|ABITUR AUFGABE TRAINING")).toBe(true);
    expect(signatures.has("6|FOTONEN SIGNAL UND FELD")).toBe(true);
    expect(signatures.has("7|QUANTEN FELDER UND WELLEN")).toBe(true);
    expect(signatures.size).toBe(1000);
  });

  it(
    "meets 1k gate: unhinted successRate >= 0.995, hinted successRate === 1.0, runtime < 3 minutes",
    () => {
      const { railFence } = loadRuntime();
      const dataset = generateRailFenceDataset(1000, 42);
      const startedAt = Date.now();

      let unhintedHits = 0;
      let hintedHits = 0;

      for (const testCase of dataset) {
        const unhinted = railFence.crack(testCase.ciphertext);
        const hinted = railFence.crack(testCase.ciphertext, { keyLength: testCase.key });

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

      expect(unhintedSuccessRate).toBeGreaterThanOrEqual(0.995);
      expect(hintedSuccessRate).toBe(1);
      expect(elapsedMs).toBeLessThan(3 * 60 * 1000);
    },
    180_000
  );
});
