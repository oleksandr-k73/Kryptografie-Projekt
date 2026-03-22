import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

const require = createRequire(import.meta.url);
const { generateSha256Dataset } = require("./generators/sha256Dataset.js");

function loadRuntime() {
  const window = loadBrowserContext([
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
    "js/ciphers/sha256Cipher.js",
  ]);
  return {
    sha256Cipher: window.KryptoCiphers.sha256Cipher,
  };
}

describe("sha256 keyless e2e 1k", () => {
  it("builds a deterministic 1000-case dataset", () => {
    const datasetA = generateSha256Dataset(1000, 42);
    const datasetB = generateSha256Dataset(1000, 42);
    const signatures = new Set(datasetA.map((entry) => entry.plaintext));

    expect(datasetA).toEqual(datasetB);
    expect(datasetA).toHaveLength(1000);
    expect(signatures.has("MELDE DICH BEI DER LEHRKRAFT WENN DU DEN TOKEN GEFUNDEN HAST")).toBe(true);
    expect(signatures.size).toBe(1000);
  });

  it(
    "meets 1k gate: hash successRate === 1.0, crack with candidates === 1.0, runtime < 2 minutes",
    () => {
      const { sha256Cipher } = loadRuntime();
      const dataset = generateSha256Dataset(1000, 42);
      const startedAt = Date.now();

      let hashHits = 0;
      let crackHits = 0;

      for (const testCase of dataset) {
        const hashed = sha256Cipher.encrypt(testCase.plaintext);

        if (hashed === testCase.hash) {
          hashHits += 1;
        }

        // Crack mit Kandidaten sollte 100% Match haben
        const cracked = sha256Cipher.crack(testCase.hash, {
          candidates: [testCase.plaintext],
        });

        if (cracked.text === testCase.plaintext) {
          crackHits += 1;
        }
      }

      const elapsedMs = Date.now() - startedAt;
      const hashSuccessRate = hashHits / dataset.length;
      const crackSuccessRate = crackHits / dataset.length;

      // Gate schützt SHA-256 vor regressiven Sonderfällen.
      expect(hashSuccessRate).toBe(1);
      expect(crackSuccessRate).toBe(1);
      expect(elapsedMs).toBeLessThan(2 * 60 * 1000);
    },
    150_000
  );
});
