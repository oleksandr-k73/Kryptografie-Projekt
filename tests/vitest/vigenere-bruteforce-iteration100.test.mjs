import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

const require = createRequire(import.meta.url);
const {
  generateIteration100,
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

function loadRequiredCases() {
  const filePath = path.resolve(
    process.cwd(),
    "tests/vitest/fixtures/vigenere-bruteforce-required-cases.json"
  );
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fallbackOptions(overrides = {}) {
  return {
    enabled: true,
    maxKeyLength: 6,
    shortTextMaxLetters: 22,
    maxTotalMs: 6_000,
    maxMsPerLength: 6_000,
    stageWidths: [12, 18, 26],
    ...overrides,
  };
}

describe("vigenere bruteforce iteration100", () => {
  it("builds a deterministic seeded dataset with requested key-length quotas", () => {
    const datasetA = generateIteration100(42);
    const datasetB = generateIteration100(42);

    expect(datasetA).toEqual(datasetB);
    expect(datasetA).toHaveLength(100);

    const counts = datasetA.reduce(
      (acc, item) => {
        if (item.keyLength >= 2 && item.keyLength <= 4) {
          acc.l2to4 += 1;
        } else if (item.keyLength >= 5 && item.keyLength <= 6) {
          acc.l5to6 += 1;
        } else if (item.keyLength >= 7 && item.keyLength <= 9) {
          acc.l7to9 += 1;
        }
        return acc;
      },
      { l2to4: 0, l5to6: 0, l7to9: 0 }
    );

    expect(counts).toEqual({
      l2to4: 40,
      l5to6: 40,
      l7to9: 20,
    });
  });

  it(
    "checks required fallback cases and gate boundaries",
    () => {
      const { vigenere } = loadRuntime();
      const requiredCases = loadRequiredCases();

      for (const requiredCase of requiredCases) {
        const cracked = vigenere.crack(requiredCase.ciphertext, {
          keyLength: requiredCase.keyLength,
          optimizations: true,
          bruteforceFallback: fallbackOptions(),
        });

        expect(cracked.search.bruteforceFallbackTriggered).toBe(
          requiredCase.expectFallbackTriggered
        );
        expect(cracked.search.bruteforceFallbackKeyLength).toBe(requiredCase.keyLength);
        expect(cracked.search.bruteforceFallbackReason).toBe(
          "short_text_low_sense_keylength_gate"
        );
        expect(cracked.search.bruteforceCombosVisited).toBeGreaterThan(0);
        expect(cracked.search.bruteforceElapsedMs).toBeGreaterThan(0);
        expect(cracked.search.sense.senseScore).toBeLessThanOrEqual(1);
        expect(cracked.search.sense.senseScore).toBeGreaterThanOrEqual(0);
      }

      const disabledByLength = vigenere.crack(requiredCases[0].ciphertext, {
        keyLength: requiredCases[0].keyLength,
        optimizations: true,
        bruteforceFallback: fallbackOptions({ maxKeyLength: 4 }),
      });
      expect(disabledByLength.search.bruteforceFallbackTriggered).toBe(false);
      expect(disabledByLength.search.bruteforceFallbackReason).toBe(
        "key_length_exceeds_max"
      );

      const disabledByTextLength = vigenere.crack(requiredCases[0].ciphertext, {
        keyLength: requiredCases[0].keyLength,
        optimizations: true,
        bruteforceFallback: fallbackOptions({ shortTextMaxLetters: 13 }),
      });
      expect(disabledByTextLength.search.bruteforceFallbackTriggered).toBe(false);
      expect(disabledByTextLength.search.bruteforceFallbackReason).toBe("text_not_short");
    },
    120_000
  );

  it(
    "meets iteration100 gate: successRate >= 0.90 and runtime < 20 minutes",
    () => {
      const { vigenere } = loadRuntime();
      const dataset = generateIteration100(42);

      const startedAt = Date.now();
      let successCount = 0;

      for (const testCase of dataset) {
        const cracked = vigenere.crack(testCase.ciphertext, {
          keyLength: testCase.keyLength,
          optimizations: true,
          bruteforceFallback: fallbackOptions(),
        });

        if (normalizeLetters(cracked.text) === normalizeLetters(testCase.plaintext)) {
          successCount += 1;
        }
      }

      const elapsedMs = Date.now() - startedAt;
      const successRate = successCount / dataset.length;

      expect(successRate).toBeGreaterThanOrEqual(0.9);
      expect(elapsedMs).toBeLessThan(20 * 60 * 1000);
    },
    1_200_000
  );
});
