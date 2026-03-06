import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

function loadRuntime(fetchImpl = () => Promise.reject(new Error("offline in test"))) {
  const window = loadBrowserContext(
    ["js/ciphers/vigenereCipher.js", "js/core/dictionaryScorer.js"],
    {
      // Deterministische Standardumgebung: Netzwerkstreuung soll Budget-/Strategietests
      // nicht beeinflussen, weil diese fachlich die Suchlogik und nicht API-Latenz prüfen.
      fetchImpl,
    }
  );
  return {
    vigenere: window.KryptoCiphers.vigenereCipher,
    scorer: window.KryptoCore.dictionaryScorer,
  };
}

describe("vigenere budgets and strategy", () => {
  it(
    "handles candidate budgets 1M, 10M and n^L on the BRICK regression",
    async () => {
      const { vigenere, scorer } = loadRuntime();
      const budgets = [1_000_000, 10_000_000, "n^L"];

      for (const budget of budgets) {
        const startedAt = Date.now();
        const cracked = vigenere.crack("Zfcurbctpdqrau", {
          keyLength: 5,
          candidateBudget: budget,
          stateBudget: 220_000,
          evaluationBudget: 60_000,
        });
        const ranked = await scorer.rankCandidates(cracked.candidates, {
          languageHints: ["en"],
        });
        const durationMs = Date.now() - startedAt;

        expect(ranked.bestCandidate.key).toBe("BRICK");
        expect(ranked.bestCandidate.text).toBe("Youshallntpass");
        expect(cracked.search.statesGenerated).toBeGreaterThan(150_000);
        expect(durationMs).toBeLessThan(90_000);
      }
    },
    120_000
  );

  it(
    "uses short-text rescue strategy on APCZX XTPMPH with keyLength=5",
    () => {
      const { vigenere } = loadRuntime();
      for (const optimizations of [false, true]) {
        const fallback = vigenere.crack("APCZX XTPMPH", {
          keyLength: 5,
          optimizations,
        });
        const narrow = vigenere.crack("APCZX XTPMPH", {
          keyLength: 5,
          candidateBudget: 5_000,
          stateBudget: 5_000,
          evaluationBudget: 5_000,
          optimizations,
        });

        expect(fallback.search.shortTextRescue).toBe(true);
        expect(fallback.search.statesGenerated).toBeGreaterThan(50_000);
        expect(fallback.search.statesGenerated).toBeGreaterThan(
          narrow.search.statesGenerated
        );
        expect(fallback.candidates.length).toBeGreaterThan(20);
      }
    },
    120_000
  );

  it(
    "covers short, medium and equal-length key scenarios",
    async () => {
      const { vigenere, scorer } = loadRuntime();
      const exactCases = [
        {
          plain: "you shall nt pass",
          key: "KEY",
          languageHints: ["en"],
        },
        {
          plain: "you and the words and the text we need for tests",
          key: "BRICKS",
          languageHints: ["en"],
        },
      ];

      for (const testCase of exactCases) {
        const cipher = vigenere.encrypt(testCase.plain, testCase.key);
        const cracked = vigenere.crack(cipher, { keyLength: testCase.key.length });
        const ranked = await scorer.rankCandidates(cracked.candidates, {
          languageHints: testCase.languageHints,
        });
        expect(ranked.bestCandidate.text).toBe(testCase.plain);
        expect(ranked.bestCandidate.key).toBe(testCase.key);
      }

      const ambiguousPlain = "youre";
      const ambiguousKey = "BRICK";
      const ambiguousCipher = vigenere.encrypt(ambiguousPlain, ambiguousKey);
      const firstRun = vigenere.crack(ambiguousCipher, {
        keyLength: ambiguousKey.length,
      });
      const secondRun = vigenere.crack(ambiguousCipher, {
        keyLength: ambiguousKey.length,
      });

      expect(firstRun.search.shortTextRescue).toBe(true);
      expect(firstRun.key).toBe(secondRun.key);
      expect(firstRun.text).toBe(secondRun.text);
      expect(firstRun.candidates.length).toBeGreaterThan(10);
    },
    60_000
  );
});
