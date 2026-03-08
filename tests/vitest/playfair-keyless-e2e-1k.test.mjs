import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

const require = createRequire(import.meta.url);
const { generatePlayfairE2EDataset } = require("./generators/playfairDataset.js");

let runtimeCache = null;

function loadRuntime() {
  if (runtimeCache) {
    return runtimeCache;
  }

  const window = loadBrowserContext([
    "js/ciphers/playfairCipher.js",
    "js/core/dictionaryScorer.js",
  ]);
  runtimeCache = {
    playfair: window.KryptoCiphers.playfairCipher,
    scorer: window.KryptoCore.dictionaryScorer,
  };
  return runtimeCache;
}

function normalizeSegmented(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeKey(key) {
  return String(key || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .replace(/J/g, "I");
}

describe("playfair keyless e2e 1k", () => {
  it("builds a deterministic 1000-case dataset", () => {
    const datasetA = generatePlayfairE2EDataset(1000, 42);
    const datasetB = generatePlayfairE2EDataset(1000, 42);
    const signatures = new Set(datasetA.map((entry) => `${entry.key}|${entry.plaintext}`));

    expect(datasetA).toEqual(datasetB);
    expect(datasetA).toHaveLength(1000);
    // Die Pflichtfälle müssen im 1k-Lauf garantiert enthalten sein, damit bekannte Playfair-Blindstellen nicht aus dem Gate herausrutschen.
    expect(signatures.has("QUANT|FOTONEN FELD")).toBe(true);
    expect(signatures.has("QUANT|FOTONEN SIGNAL")).toBe(true);
    expect(signatures.has("QUANT|IMPULS UND ENERGIE")).toBe(true);
    expect(signatures.has("QUANT|KOHARENZ FELD")).toBe(true);
    expect(signatures.has("QUANT|MACHZEHNDERSIGNAL")).toBe(true);

    expect(signatures.size).toBe(1000);
  });

  it(
    "meets 1k gate: segmentedTextAccuracy >= 0.95, keyAccuracy >= 0.90, runtime < 4 minutes",
    () => {
      const { playfair, scorer } = loadRuntime();
      const dataset = generatePlayfairE2EDataset(1000, 42);
      const keyCandidates = scorer.getKeyCandidates({
        languageHints: ["de", "en"],
        limit: 320,
      });

      let segmentedHits = 0;
      let keyHits = 0;
      const startedAt = Date.now();

      for (const testCase of dataset) {
        const cipherText = playfair.encrypt(testCase.plaintext, testCase.key);
        const cracked = playfair.crack(cipherText, {
          keyCandidates,
          languageHints: ["de", "en"],
        });

        const expectedText = normalizeSegmented(testCase.plaintext);
        const actualText = normalizeSegmented(cracked.text);
        if (actualText === expectedText) {
          segmentedHits += 1;
        }

        if (normalizeKey(cracked.key) === normalizeKey(testCase.key)) {
          keyHits += 1;
        }
      }

      const elapsedMs = Date.now() - startedAt;
      const segmentedTextAccuracy = segmentedHits / dataset.length;
      const keyAccuracy = keyHits / dataset.length;

      expect(segmentedTextAccuracy).toBeGreaterThanOrEqual(0.95);
      expect(keyAccuracy).toBeGreaterThanOrEqual(0.9);
      expect(elapsedMs).toBeLessThan(4 * 60 * 1000);
    },
    300_000
  );
});
