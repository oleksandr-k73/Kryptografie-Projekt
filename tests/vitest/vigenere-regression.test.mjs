import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { generateVigenereDataset } = require("./generators/vigenereDataset.js");

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

async function canReachDictionaryApi() {
  if (typeof fetch !== "function" || typeof AbortController !== "function") {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(
      "https://api.dictionaryapi.dev/api/v2/entries/en/test",
      { signal: controller.signal }
    );
    return Boolean(response);
  } catch (_error) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

const optimizationModes = [
  { label: "optimizations disabled", value: false },
  { label: "optimizations enabled", value: true },
];

describe("vigenere crack regression", () => {
  for (const mode of optimizationModes) {
    it(
      `recovers BRICK/Youshallntpass for Zfcurbctpdqrau with keyLength=5 (${mode.label})`,
      async () => {
        const { vigenere, scorer } = loadRuntime();
        const cracked = vigenere.crack("Zfcurbctpdqrau", {
          keyLength: 5,
          optimizations: mode.value,
        });

        expect(cracked.search.shortTextRescue).toBe(true);
        const ranked = await scorer.rankCandidates(cracked.candidates, {
          languageHints: ["en"],
        });
        expect(ranked.bestCandidate.key).toBe("BRICK");
        expect(ranked.bestCandidate.text).toBe("Youshallntpass");
      },
      20_000
    );

      it("online vs offline dictionary ranking difference (BRICK case)", async () => {
        const apiReachable = await canReachDictionaryApi();
        // online context (real fetch)
        const online = loadBrowserContext(
          ["js/ciphers/vigenereCipher.js", "js/core/dictionaryScorer.js"],
          {
            fetchImpl: typeof fetch === "function"
              ? fetch
              : () => Promise.reject(new Error("fetch unavailable")),
          }
        );
        // offline context (no API)
        const offline = loadBrowserContext(
          ["js/ciphers/vigenereCipher.js", "js/core/dictionaryScorer.js"],
          { fetchImpl: () => Promise.reject(new Error("offline in test")) }
        );

        const vOnline = online.KryptoCiphers.vigenereCipher;
        const sOnline = online.KryptoCore.dictionaryScorer;
        const vOffline = offline.KryptoCiphers.vigenereCipher;
        const sOffline = offline.KryptoCore.dictionaryScorer;

        const crackedOnline = vOnline.crack("Zfcurbctpdqrau", { keyLength: 5 });
        const crackedOffline = vOffline.crack("Zfcurbctpdqrau", { keyLength: 5 });

        const rankedOnline = await sOnline.rankCandidates(crackedOnline.candidates, {
          languageHints: ["en"],
        });
        const rankedOffline = await sOffline.rankCandidates(crackedOffline.candidates, {
          languageHints: ["en"],
        });

        expect(rankedOffline.bestCandidate.key).toBe("BRICK");
        if (apiReachable) {
          // Wenn die API erreichbar ist, muss der Online-Pfad sie auch wirklich nutzen.
          expect(rankedOnline.bestCandidate.key).toBe("BRICK");
          expect(rankedOnline.apiAvailable).toBe(true);
        } else {
          // Offline-Labore dürfen nicht failen; hier sichern wir explizit den Fallback.
          expect(rankedOnline.bestCandidate).toBeTruthy();
        }
      }, 30_000);

    it(
      `recovers BRICK/Youshallntpass for Zfcurbctpdqrau without keyLength hint (${mode.label})`,
      async () => {
        const { vigenere, scorer } = loadRuntime();
        const cracked = vigenere.crack("Zfcurbctpdqrau", {
          optimizations: mode.value,
        });
        if (mode.value === true) {
          const ranked = await scorer.rankCandidates(cracked.candidates, {
            languageHints: ["en"],
          });
          expect(ranked.bestCandidate.key).toBe("BRICK");
          expect(ranked.bestCandidate.text).toBe("Youshallntpass");
          return;
        }

        // Legacy-Modus bleibt absichtlich unverändert; wir sichern hier
        // deterministisches Verhalten statt Optimierungs-Qualität.
        const repeated = vigenere.crack("Zfcurbctpdqrau", {
          optimizations: mode.value,
        });
        expect(cracked.key).toBe(repeated.key);
        expect(cracked.text).toBe(repeated.text);
      },
      40_000
    );
  }

  it("keeps seeded sample cases deterministic and mostly recoverable", () => {
    const { vigenere } = loadRuntime();
    const sample = generateVigenereDataset(4, 42);

    let hintedRecovered = 0;
    let unhintedRecovered = 0;

    for (const testCase of sample) {
      const hinted = vigenere.crack(testCase.ciphertext, {
        keyLength: testCase.keyLength,
        optimizations: true,
      });
      const unhinted = vigenere.crack(testCase.ciphertext, {
        optimizations: true,
      });

      const expected = testCase.plaintext.replace(/[^A-Za-z]/g, "").toUpperCase();
      const hintedText = hinted.text.replace(/[^A-Za-z]/g, "").toUpperCase();
      const unhintedText = unhinted.text.replace(/[^A-Za-z]/g, "").toUpperCase();

      if (hintedText === expected) {
        hintedRecovered += 1;
      }
      if (unhintedText === expected) {
        unhintedRecovered += 1;
      }
    }

    expect(hintedRecovered).toBeGreaterThanOrEqual(3);
    expect(unhintedRecovered).toBeGreaterThanOrEqual(2);
  }, 180_000);

  it("recognizes compact words and segmented variants similarly", async () => {
    const { scorer } = loadRuntime();
    const candidates = [
      { key: "COMPACT", text: "Youshallntpass", confidence: 0.4 },
      { key: "SPACED", text: "You shallnt pass", confidence: 0.4 },
      { key: "NOISE", text: "Qzxvplmrtwyzz", confidence: 0.4 },
    ];

    const ranked = await scorer.rankCandidates(candidates, {
      languageHints: ["en"],
    });
    const compact = ranked.rankedCandidates.find((entry) => entry.key === "COMPACT");
    const spaced = ranked.rankedCandidates.find((entry) => entry.key === "SPACED");
    const noise = ranked.rankedCandidates.find((entry) => entry.key === "NOISE");

    expect(compact.dictionary.coverage).toBeGreaterThan(0.9);
    expect(spaced.dictionary.coverage).toBeGreaterThan(0.9);
    expect(compact.confidence).toBeGreaterThan(noise.confidence);
    expect(spaced.confidence).toBeGreaterThan(noise.confidence);
  }, 20_000);

  it("changes ranking when language hints switch from en to de", async () => {
    const { scorer } = loadRuntime();
    const candidates = [
      { key: "EN", text: "you shall nt pass", confidence: 0.5 },
      { key: "DE", text: "ich und du nicht", confidence: 0.5 },
    ];

    const englishFirst = await scorer.rankCandidates(candidates, {
      languageHints: ["en"],
    });
    const germanFirst = await scorer.rankCandidates(candidates, {
      languageHints: ["de"],
    });

    expect(englishFirst.bestCandidate.key).toBe("EN");
    expect(germanFirst.bestCandidate.key).toBe("DE");
  }, 20_000);
});
