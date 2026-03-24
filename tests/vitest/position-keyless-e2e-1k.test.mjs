import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

const require = createRequire(import.meta.url);
const { generatePositionDataset } = require("./generators/positionDataset.js");

function loadRuntime() {
  const window = loadBrowserContext([
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
    "js/ciphers/positionCipher.js",
  ]);
  return {
    position: window.KryptoCiphers.positionCipher,
  };
}

function normalizeVisibleText(text) {
  // Crack-Erfolg wird gegen die A-Z-Normalisierung geprüft; Leerzeichen sind nur Segment-Hilfen.
  return String(text || "")
    .replace(/Ä/g, "AE")
    .replace(/Ö/g, "OE")
    .replace(/Ü/g, "UE")
    .replace(/ä/g, "AE")
    .replace(/ö/g, "OE")
    .replace(/ü/g, "UE")
    .replace(/ß/g, "SS")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

describe("position cipher keyless e2e 1k", () => {
  it("builds a deterministic 1000-case dataset", () => {
    const datasetA = generatePositionDataset(1000, 42);
    const datasetB = generatePositionDataset(1000, 42);
    const signatures = new Set(datasetA.map((entry) => `${entry.key}|${entry.plaintext}`));

    expect(datasetA).toEqual(datasetB);
    expect(datasetA).toHaveLength(1000);
    expect(signatures.has("2-5-3-1-4|QUANTEN SPRUNG")).toBe(true);
    expect(signatures.has("2-1-3|LASER TRIFFT GITTER")).toBe(true);
    expect(signatures.has("1-3-2-4-5|PHOTOEFFEKT DATEN")).toBe(true);
    expect(signatures.has("2-1-3-5-4-6|MESSREIHE MIT FEHLER")).toBe(true);
    expect(signatures.has("2-1|UNSCHAERFE IM ORT")).toBe(true);
    expect(signatures.size).toBe(1000);
  });

  it(
    "meets 1k gate: unhinted successRate >= 0.99, hinted successRate === 1.0, runtime < 3 minutes",
    () => {
      const { position } = loadRuntime();
      const dataset = generatePositionDataset(1000, 42);
      const startedAt = Date.now();

      let unhintedHits = 0;
      let hintedHits = 0;

      for (const testCase of dataset) {
        const unhinted = position.crack(testCase.ciphertext);
        const hinted = position.crack(testCase.ciphertext, { keyLength: testCase.keyLength });

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
    // Timeout > 3 Minuten, damit die Laufzeit-Assertion realistisch erreicht werden kann.
    210_000
  );
});
