import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

const require = createRequire(import.meta.url);
const { generateAffineDataset } = require("./generators/affineDataset.js");

function loadRuntime() {
  const window = loadBrowserContext(["js/ciphers/affineCipher.js"]);
  return {
    affine: window.KryptoCiphers.affineCipher,
  };
}

function normalizeVisibleText(text) {
  // Crack-Erfolg wird auf der sichtbaren A-Z-Form geprüft; Leerzeichen sind nur Layout.
  return String(text || "").replace(/\s+/g, "").toUpperCase();
}

describe("affine keyless e2e 1k", () => {
  it("builds a deterministic 1000-case dataset", () => {
    const datasetA = generateAffineDataset(1000, 42);
    const datasetB = generateAffineDataset(1000, 42);
    const signatures = new Set(datasetA.map((entry) => `${entry.key}|${entry.plaintext}`));

    expect(datasetA).toEqual(datasetB);
    expect(datasetA).toHaveLength(1000);
    expect(signatures.has("5,8|WAHRSCHEINLICHKEITSDICHTE")).toBe(true);
    expect(signatures.has("7,3|QUANTEN FELDER UND WELLEN")).toBe(true);
    expect(signatures.has("11,19|POTENTIALTOPF MODELL")).toBe(true);
    expect(signatures.size).toBe(1000);
  });

  it(
    "meets 1k gate: unhinted successRate >= 0.99, runtime < 2 minutes",
    () => {
      const { affine } = loadRuntime();
      const dataset = generateAffineDataset(1000, 42);
      const startedAt = Date.now();

      let unhintedHits = 0;

      for (const testCase of dataset) {
        const unhinted = affine.crack(testCase.ciphertext);

        if (
          normalizeVisibleText(unhinted.text) ===
          normalizeVisibleText(testCase.plaintext)
        ) {
          unhintedHits += 1;
        }
      }

      const elapsedMs = Date.now() - startedAt;
      const unhintedSuccessRate = unhintedHits / dataset.length;

      expect(unhintedSuccessRate).toBeGreaterThanOrEqual(0.99);
      expect(elapsedMs).toBeLessThan(2 * 60 * 1000);
    },
    // Timeout > 2 Minuten, damit die Laufzeit-Assertion realistisch erreicht werden kann.
    150_000
  );
});
