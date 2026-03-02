import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

function loadRuntime() {
  const window = loadBrowserContext(
    ["js/ciphers/vigenereCipher.js", "js/core/dictionaryScorer.js"],
    {
      fetchImpl: typeof fetch === "function" ? fetch : () => Promise.reject(new Error("fetch unavailable")),
    }
  );
  return {
    vigenere: window.KryptoCiphers.vigenereCipher,
    scorer: window.KryptoCore.dictionaryScorer,
  };
}

function createRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

describe("vigenere performance smoke", () => {
  it("keeps medium-text known-length cracking stable on a deterministic mini-suite", async () => {
    const { vigenere, scorer } = loadRuntime();
    const rng = createRng(1337);

    const englishWords = [
      "you",
      "and",
      "the",
      "words",
      "text",
      "need",
      "for",
      "tests",
      "decode",
      "decrypt",
      "not",
      "pass",
      "shall",
    ];
    const germanWords = [
      "ich",
      "und",
      "du",
      "nicht",
      "das",
      "ist",
      "ein",
      "text",
      "mit",
      "und",
      "nicht",
      "ich",
    ];
    const keys = ["KEY", "CODE", "LANG", "GATE"];

    const totalCases = 24;
    let successCount = 0;
    const durations = [];

    for (let i = 0; i < totalCases; i += 1) {
      const language = i % 2 === 0 ? "en" : "de";
      const words = language === "en" ? englishWords : germanWords;
      const parts = [];
      const targetWordCount = 10 + Math.floor(rng() * 4);
      for (let w = 0; w < targetWordCount; w += 1) {
        parts.push(pick(rng, words));
      }
      const plain = parts.join(" ");
      const key = pick(rng, keys);
      const cipher = vigenere.encrypt(plain, key);

      const startedAt = Date.now();
      const cracked = vigenere.crack(cipher, {
        keyLength: key.length,
        optimizations: true,
      });
      const ranked = await scorer.rankCandidates(cracked.candidates, {
        languageHints: [language],
      });
      durations.push(Date.now() - startedAt);

      if (ranked.bestCandidate.text === plain) {
        successCount += 1;
      }
    }

    const successRate = successCount / totalCases;
    const averageMs =
      durations.reduce((sum, value) => sum + value, 0) / Math.max(1, durations.length);

    expect(successRate).toBeGreaterThanOrEqual(0.8);
    // Online-Dictionary-Lookups können in CI/Lab-Umgebungen schwanken; der
    // Grenzwert bleibt bewusst großzügig, damit wir Regressionen erkennen ohne
    // flakey Netzwerk-Latenz als Testfehler zu zählen.
    expect(averageMs).toBeLessThan(6_000);
  }, 180_000);
});
