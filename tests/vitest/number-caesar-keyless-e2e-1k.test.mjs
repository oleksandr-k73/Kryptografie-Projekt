import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

const require = createRequire(import.meta.url);
const { generateNumberCaesarDataset } = require("./generators/numberCaesarDataset.js");

function loadRuntime() {
  const window = loadBrowserContext([
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
    "js/ciphers/numberCaesarCipher.js",
  ]);
  return {
    numberCaesar: window.KryptoCiphers.numberCaesarCipher,
  };
}

function normalizeVisibleText(text) {
  // Crack liefert Rohtext ohne Leerzeichen, daher wird fuer Vergleiche verdichtet.
  return String(text || "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

describe("number caesar keyless e2e 1k", () => {
  it("builds a deterministic 1000-case dataset", () => {
    const datasetA = generateNumberCaesarDataset(1000, 42);
    const datasetB = generateNumberCaesarDataset(1000, 42);
    const signatures = new Set(datasetA.map((entry) => `${entry.key}|${entry.plaintext}`));

    expect(datasetA).toEqual(datasetB);
    expect(datasetA).toHaveLength(1000);
    expect(signatures.has("3|MODELL UND GRENZEN")).toBe(true);
    expect(signatures.has("7|QUANTEN FELD UND WELLEN")).toBe(true);
    expect(signatures.has("11|LASER IMPULS UND SIGNAL")).toBe(true);
    expect(signatures.size).toBe(1000);
  });

  it(
    "meets 1k gate: unhinted successRate >= 0.99, hinted successRate === 1.0, runtime < 3 minutes",
    () => {
      const { numberCaesar } = loadRuntime();
      const dataset = generateNumberCaesarDataset(1000, 42);
      const startedAt = Date.now();

      let unhintedHits = 0;
      let hintedHits = 0;

      for (const testCase of dataset) {
        const unhinted = numberCaesar.crack(testCase.ciphertext);
        const hinted = numberCaesar.decrypt(testCase.ciphertext, testCase.key);

        if (normalizeVisibleText(unhinted.text) === normalizeVisibleText(testCase.plaintext)) {
          unhintedHits += 1;
        }

        if (normalizeVisibleText(hinted) === normalizeVisibleText(testCase.plaintext)) {
          hintedHits += 1;
        }
      }

      const elapsedMs = Date.now() - startedAt;
      const unhintedSuccessRate = unhintedHits / dataset.length;
      const hintedSuccessRate = hintedHits / dataset.length;

      // Hinted entspricht der bekannten Schluessel-Entschluesselung, damit Key-Parsing gesichert bleibt.
      expect(unhintedSuccessRate).toBeGreaterThanOrEqual(0.99);
      expect(hintedSuccessRate).toBe(1);
      expect(elapsedMs).toBeLessThan(3 * 60 * 1000);
    },
    180_000
  );
});
