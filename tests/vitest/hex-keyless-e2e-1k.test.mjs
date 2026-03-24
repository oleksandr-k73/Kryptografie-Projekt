import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

const require = createRequire(import.meta.url);
const { generateHexDataset } = require("./generators/hexDataset.js");

function loadRuntime() {
  const window = loadBrowserContext([
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
    "js/ciphers/hexCipher.js",
  ]);
  return {
    hexCipher: window.KryptoCiphers.hexCipher,
  };
}

function normalizeVisibleText(text) {
  // Segmentierung darf Leerzeichen variieren, der sichtbare Klartext bleibt identisch.
  return String(text || "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

describe("hex keyless e2e 1k", () => {
  it("builds a deterministic 1000-case dataset", () => {
    const datasetA = generateHexDataset(1000, 42);
    const datasetB = generateHexDataset(1000, 42);
    const signatures = new Set(datasetA.map((entry) => entry.plaintext));

    expect(datasetA).toEqual(datasetB);
    expect(datasetA).toHaveLength(1000);
    expect(signatures.has("INTERFERENZ AM SPALT")).toBe(true);
    expect(signatures.size).toBe(1000);
  });

  it(
    "meets 1k gate: decrypt + crack successRate === 1.0, runtime < 2 minutes",
    () => {
      const { hexCipher } = loadRuntime();
      const dataset = generateHexDataset(1000, 42);
      const startedAt = Date.now();

      let decryptHits = 0;
      let crackHits = 0;

      for (const testCase of dataset) {
        const decrypted = hexCipher.decrypt(testCase.ciphertext);
        const cracked = hexCipher.crack(testCase.ciphertext);

        if (decrypted === testCase.plaintext) {
          decryptHits += 1;
        }

        if (normalizeVisibleText(cracked.text) === normalizeVisibleText(testCase.plaintext)) {
          crackHits += 1;
        }
      }

      const elapsedMs = Date.now() - startedAt;
      const decryptSuccessRate = decryptHits / dataset.length;
      const crackSuccessRate = crackHits / dataset.length;

      // Gate schuetzt HEX-Decode vor regressiven Sonderfaellen.
      expect(decryptSuccessRate).toBe(1);
      expect(crackSuccessRate).toBe(1);
      expect(elapsedMs).toBeLessThan(2 * 60 * 1000);
    },
    150_000
  );
});
