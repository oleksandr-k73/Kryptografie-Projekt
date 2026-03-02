import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

const require = createRequire(import.meta.url);
const {
  generateFinalStress1000,
} = require("./generators/vigenereFallbackDatasets.js");

function loadRuntime() {
  const window = loadBrowserContext(["js/ciphers/vigenereCipher.js"]);
  return {
    vigenere: window.KryptoCiphers.vigenereCipher,
  };
}

function normalizeLetters(value) {
  return String(value || "").replace(/[^A-Za-z]/g, "").toUpperCase();
}

function fallbackOptions() {
  return {
    enabled: true,
    maxKeyLength: 6,
    shortTextMaxLetters: 22,
    maxTotalMs: 6_000,
    maxMsPerLength: 6_000,
    stageWidths: [12, 18, 26],
  };
}

describe("vigenere bruteforce final1k", () => {
  it("builds a deterministic seeded final dataset with requested quotas", () => {
    const datasetA = generateFinalStress1000(42);
    const datasetB = generateFinalStress1000(42);

    expect(datasetA).toEqual(datasetB);
    expect(datasetA).toHaveLength(1000);

    const counts = datasetA.reduce(
      (acc, item) => {
        if (item.keyLength >= 2 && item.keyLength <= 6) {
          acc.l2to6 += 1;
        } else if (item.keyLength >= 7 && item.keyLength <= 10) {
          acc.l7to10 += 1;
        }
        return acc;
      },
      { l2to6: 0, l7to10: 0 }
    );

    expect(counts).toEqual({
      l2to6: 700,
      l7to10: 300,
    });
  });

  it(
    "meets final1k gate: successRate >= 0.88, runtime < 60 minutes, telemetry consistent",
    () => {
      const { vigenere } = loadRuntime();
      const dataset = generateFinalStress1000(42);
      const startedAt = Date.now();

      let successCount = 0;
      for (const testCase of dataset) {
        const cracked = vigenere.crack(testCase.ciphertext, {
          keyLength: testCase.keyLength,
          optimizations: true,
          bruteforceFallback: fallbackOptions(),
        });

        const search = cracked.search || {};
        expect(typeof search.bruteforceFallbackTriggered).toBe("boolean");
        expect(typeof search.bruteforceFallbackReason).toBe("string");
        expect(typeof search.bruteforceCombosVisited).toBe("number");
        expect(typeof search.bruteforceElapsedMs).toBe("number");
        expect(search.sense).toBeTruthy();
        expect(search.sense.senseScore).toBeGreaterThanOrEqual(0);
        expect(search.sense.senseScore).toBeLessThanOrEqual(1);
        expect(search.sense.meaningfulTokenRatio).toBeGreaterThanOrEqual(0);
        expect(search.sense.meaningfulTokenRatio).toBeLessThanOrEqual(1);
        expect(search.sense.nonsenseRatio).toBeGreaterThanOrEqual(0);
        expect(search.sense.nonsenseRatio).toBeLessThanOrEqual(1);
        expect(search.sense.dictCoverageProxy).toBeGreaterThanOrEqual(0);
        expect(search.sense.dictCoverageProxy).toBeLessThanOrEqual(1);

        if (search.bruteforceFallbackTriggered) {
          expect(search.bruteforceFallbackKeyLength).toBe(testCase.keyLength);
          expect(search.bruteforceCombosVisited).toBeGreaterThan(0);
          expect(search.bruteforceElapsedMs).toBeGreaterThan(0);
        } else {
          expect(search.bruteforceFallbackKeyLength).toBeNull();
        }

        if (normalizeLetters(cracked.text) === normalizeLetters(testCase.plaintext)) {
          successCount += 1;
        }
      }

      const elapsedMs = Date.now() - startedAt;
      const successRate = successCount / dataset.length;

      expect(successRate).toBeGreaterThanOrEqual(0.88);
      expect(elapsedMs).toBeLessThan(60 * 60 * 1000);
    },
    3_600_000
  );
});
