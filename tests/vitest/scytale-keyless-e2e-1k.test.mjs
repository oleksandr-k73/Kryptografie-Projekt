import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

const require = createRequire(import.meta.url);
const { generateScytaleDataset } = require("./generators/scytaleDataset.js");

function loadRuntime() {
  const window = loadBrowserContext([
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
    "js/ciphers/scytaleCipher.js",
  ]);
  return {
    scytale: window.KryptoCiphers.scytaleCipher,
  };
}

function normalizeVisibleText(text) {
  // Crack-Erfolg wird gegen den sichtbaren Text geprüft; Leerzeichen sind nur Segment-Hilfen.
  return String(text || "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

describe("scytale keyless e2e 1k", () => {
  it("builds a deterministic 1000-case dataset", () => {
    const datasetA = generateScytaleDataset(1000, 42);
    const datasetB = generateScytaleDataset(1000, 42);
    const signatures = new Set(datasetA.map((entry) => `${entry.key}|${entry.plaintext}`));

    expect(datasetA).toEqual(datasetB);
    expect(datasetA).toHaveLength(1000);
    expect(signatures.has("4|LASER TRIFFT GITTER")).toBe(true);
    expect(signatures.has("5|PHOTOEFFEKT DATEN")).toBe(true);
    expect(signatures.has("6|MESSREIHE MIT FEHLER")).toBe(true);
    expect(signatures.has("7|UNSCHAERFE IM ORT")).toBe(true);
    expect(
      signatures.has("4|DCODE PLAYFAIR BITTE FUNKTIONIERE ICH MUSS WEITER")
    ).toBe(true);
    expect(signatures.size).toBe(1000);
  });

  it(
    "meets 1k gate: unhinted successRate >= 0.99, hinted successRate === 1.0, runtime < 3 minutes",
    () => {
      const { scytale } = loadRuntime();
      const dataset = generateScytaleDataset(1000, 42);
      const startedAt = Date.now();

      let unhintedHits = 0;
      let hintedHits = 0;

      for (const testCase of dataset) {
        const unhinted = scytale.crack(testCase.ciphertext);
        const hinted = scytale.crack(testCase.ciphertext, { keyLength: testCase.key });

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

      expect(unhintedSuccessRate).toBeGreaterThanOrEqual(0.99);
      expect(hintedSuccessRate).toBe(1);
      expect(elapsedMs).toBeLessThan(3 * 60 * 1000);
    },
    180_000
  );
});
