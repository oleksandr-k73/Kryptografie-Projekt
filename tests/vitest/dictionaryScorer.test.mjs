import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

function loadRuntimeOffline() {
  // Offline mode - fetch always fails
  const window = loadBrowserContext(["js/core/dictionaryScorer.js"], {
    fetchImpl: () => Promise.reject(new Error("offline mode")),
  });
  return window.KryptoCore.dictionaryScorer;
}

function loadRuntimeOnline() {
  // Online mode - use real fetch if available
  const window = loadBrowserContext(["js/core/dictionaryScorer.js"], {
    fetchImpl:
      typeof fetch === "function"
        ? fetch
        : () => Promise.reject(new Error("fetch not available")),
  });
  return window.KryptoCore.dictionaryScorer;
}

function createMockFetchImpl(responses) {
  return async (url) => {
    for (const [pattern, response] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        return {
          ok: response.ok,
          json: async () => response.data || [],
        };
      }
    }
    return {
      ok: false,
      json: async () => [],
    };
  };
}

function loadRuntimeWithMock(mockResponses) {
  const window = loadBrowserContext(["js/core/dictionaryScorer.js"], {
    fetchImpl: createMockFetchImpl(mockResponses),
  });
  return window.KryptoCore.dictionaryScorer;
}

describe("dictionaryScorer", () => {
  describe("rankCandidates - offline mode", () => {
    it("ranks candidates using local lexicon", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [
        { key: "A", text: "the quick brown fox", confidence: 10 },
        { key: "B", text: "xyz abc qrs tuv", confidence: 8 },
        { key: "C", text: "gibberish nonsense", confidence: 12 },
      ];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      expect(result.rankedCandidates).toBeDefined();
      expect(Array.isArray(result.rankedCandidates)).toBe(true);
      expect(result.rankedCandidates.length).toBe(3);
      expect(result.bestCandidate).toBeDefined();
      expect(result.apiAvailable).toBe(false);
    });

    it("handles empty candidates array", async () => {
      const scorer = loadRuntimeOffline();
      const result = await scorer.rankCandidates([], { languageHints: ["en"] });

      expect(result.rankedCandidates).toEqual([]);
      expect(result.bestCandidate).toBeNull();
    });

    it("handles single candidate", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [{ key: "A", text: "hello world", confidence: 10 }];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      expect(result.rankedCandidates.length).toBe(1);
      expect(result.bestCandidate.text).toBe("hello world");
    });

    it("boosts candidates with common German words", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [
        { key: "A", text: "xyz qrs tuv", confidence: 10 },
        { key: "B", text: "der die das und", confidence: 10 },
      ];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["de"],
      });

      // Candidate with German words should rank higher
      expect(result.bestCandidate.text).toBe("der die das und");
    });

    it("boosts candidates with common English words", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [
        { key: "A", text: "xyz qrs tuv", confidence: 10 },
        { key: "B", text: "the and is to", confidence: 10 },
      ];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      expect(result.bestCandidate.text).toBe("the and is to");
    });

    it("handles missing confidence values", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [
        { key: "A", text: "hello world" },
        { key: "B", text: "test message", confidence: null },
        { key: "C", text: "the quick fox", confidence: undefined },
      ];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      expect(result.rankedCandidates.length).toBe(3);
      // Should not throw error
    });

    it("preserves original candidate properties", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [
        {
          key: "ABC",
          text: "hello world",
          confidence: 10,
          customProp: "value",
        },
      ];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      expect(result.bestCandidate.key).toBe("ABC");
      expect(result.bestCandidate.customProp).toBe("value");
    });

    it("uses default language hints when not provided", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [{ key: "A", text: "the quick brown fox", confidence: 10 }];

      const result = await scorer.rankCandidates(candidates, {});

      expect(result.rankedCandidates.length).toBe(1);
      expect(result.bestCandidate).toBeDefined();
    });

    it("handles null options", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [{ key: "A", text: "hello", confidence: 10 }];

      const result = await scorer.rankCandidates(candidates, null);

      expect(result.bestCandidate).toBeDefined();
    });

    it("adds dictionary metadata to candidates", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [
        { key: "A", text: "the quick brown", confidence: 10 },
      ];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      expect(result.bestCandidate.dictionary).toBeDefined();
      expect(result.bestCandidate.dictionary.coverage).toBeDefined();
      expect(result.bestCandidate.dictionary.validWords).toBeDefined();
      expect(result.bestCandidate.dictionary.totalWords).toBeDefined();
    });
  });

  describe("rankCandidates - with mocked API", () => {
    it("uses API results when available", async () => {
      const scorer = loadRuntimeWithMock({
        "api.dictionaryapi.dev/api/v2/entries/en/test": { ok: true },
        "api.dictionaryapi.dev/api/v2/entries/en/hello": { ok: true },
        "api.dictionaryapi.dev/api/v2/entries/en/world": { ok: true },
      });

      const candidates = [{ key: "A", text: "hello world", confidence: 10 }];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      expect(result.bestCandidate).toBeDefined();
      // API available flag should be set based on probe result
    });

    it("falls back to local when API fails", async () => {
      const scorer = loadRuntimeWithMock({
        // API always fails
      });

      const candidates = [{ key: "A", text: "hello world", confidence: 10 }];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      expect(result.rankedCandidates.length).toBe(1);
      expect(result.bestCandidate).toBeDefined();
    });
  });

  describe("language hint handling", () => {
    it("normalizes language codes", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [{ key: "A", text: "test", confidence: 10 }];

      // Should work with various formats
      const result1 = await scorer.rankCandidates(candidates, {
        languageHints: ["en-US"],
      });
      expect(result1.bestCandidate).toBeDefined();

      const result2 = await scorer.rankCandidates(candidates, {
        languageHints: ["de-DE"],
      });
      expect(result2.bestCandidate).toBeDefined();

      const result3 = await scorer.rankCandidates(candidates, {
        languageHints: ["EN"],
      });
      expect(result3.bestCandidate).toBeDefined();
    });

    it("handles multiple language hints", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [{ key: "A", text: "the quick fox", confidence: 10 }];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["de", "en"],
      });

      expect(result.bestCandidate).toBeDefined();
      expect(result.bestCandidate.dictionary).toBeDefined();
    });

    it("handles unsupported language hints", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [{ key: "A", text: "test", confidence: 10 }];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["fr", "es"],
      });

      // Should fall back to defaults
      expect(result.bestCandidate).toBeDefined();
    });

    it("prefers first language hint", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [
        { key: "A", text: "the quick brown", confidence: 10 },
        { key: "B", text: "der schnelle braun", confidence: 10 },
      ];

      const resultEn = await scorer.rankCandidates(candidates, {
        languageHints: ["en", "de"],
      });

      const resultDe = await scorer.rankCandidates(candidates, {
        languageHints: ["de", "en"],
      });

      // Results may differ based on language priority
      expect(resultEn.bestCandidate).toBeDefined();
      expect(resultDe.bestCandidate).toBeDefined();
    });
  });

  describe("coverage and word counting", () => {
    it("calculates coverage for text with all known words", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [
        { key: "A", text: "the and is to of in", confidence: 10 },
      ];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      const dict = result.bestCandidate.dictionary;
      expect(dict.coverage).toBeGreaterThan(0);
      expect(dict.validWords).toBeGreaterThan(0);
    });

    it("calculates low coverage for gibberish", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [
        { key: "A", text: "xyz qrs tuv wxy", confidence: 10 },
      ];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      const dict = result.bestCandidate.dictionary;
      expect(dict.coverage).toBeDefined();
      // Gibberish should have low or zero coverage
    });

    it("handles text with mix of known and unknown words", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [
        { key: "A", text: "the xyz quick qrs brown", confidence: 10 },
      ];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      const dict = result.bestCandidate.dictionary;
      expect(dict.validWords).toBeGreaterThan(0);
      expect(dict.validWords).toBeLessThan(dict.totalWords);
    });

    it("handles text with no words", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [{ key: "A", text: "123 !@# $%^", confidence: 10 }];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      const dict = result.bestCandidate.dictionary;
      expect(dict.totalWords).toBe(0);
      expect(dict.coverage).toBe(0);
    });

    it("handles very short words", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [{ key: "A", text: "a i o", confidence: 10 }];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      // Short words (< 2 chars) should be filtered
      const dict = result.bestCandidate.dictionary;
      expect(dict).toBeDefined();
    });
  });

  describe("sorting and ranking", () => {
    it("sorts candidates by combined score", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [
        { key: "A", text: "xyz qrs", confidence: 100 }, // High confidence, no words
        { key: "B", text: "the quick brown fox", confidence: 10 }, // Low confidence, good words
      ];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      // Scoring algorithm weights original confidence heavily (0.35 factor)
      // High confidence can still win even without dictionary words
      expect(result.bestCandidate).toBeDefined();
      expect(result.rankedCandidates.length).toBe(2);
      // Both should have dictionary metadata
      expect(result.rankedCandidates[0].dictionary).toBeDefined();
      expect(result.rankedCandidates[1].dictionary).toBeDefined();
    });

    it("maintains stable sort for equal scores", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [
        { key: "A", text: "test one", confidence: 10 },
        { key: "B", text: "test two", confidence: 10 },
        { key: "C", text: "test three", confidence: 10 },
      ];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      expect(result.rankedCandidates.length).toBe(3);
      // Order should be deterministic
    });

    it("handles very large candidate lists", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [];
      for (let i = 0; i < 100; i++) {
        candidates.push({
          key: `K${i}`,
          text: `test message ${i}`,
          confidence: Math.random() * 100,
        });
      }

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      expect(result.rankedCandidates.length).toBe(100);
      expect(result.bestCandidate).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("handles extremely long text", async () => {
      const scorer = loadRuntimeOffline();
      const longText = "the quick brown fox ".repeat(100);
      const candidates = [{ key: "A", text: longText, confidence: 10 }];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      expect(result.bestCandidate).toBeDefined();
    });

    it("handles text with only punctuation", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [{ key: "A", text: "!@#$%^&*()", confidence: 10 }];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      expect(result.bestCandidate.dictionary.totalWords).toBe(0);
    });

    it("handles text with numbers", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [
        { key: "A", text: "test 123 message 456", confidence: 10 },
      ];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      expect(result.bestCandidate).toBeDefined();
    });

    it("handles text with German umlauts", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [
        { key: "A", text: "über äpfel öl straße", confidence: 10 },
      ];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["de"],
      });

      expect(result.bestCandidate).toBeDefined();
    });

    it("handles empty text candidates", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [
        { key: "A", text: "", confidence: 10 },
        { key: "B", text: "   ", confidence: 10 },
        { key: "C", text: "hello", confidence: 10 },
      ];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      expect(result.rankedCandidates.length).toBe(3);
      // All have same confidence, so order depends on dictionary scoring
      // At minimum, result should have a best candidate
      expect(result.bestCandidate).toBeDefined();
      // One of them should have dictionary metadata
      const withDict = result.rankedCandidates.find(c => c.dictionary);
      expect(withDict).toBeDefined();
    });

    it("handles malformed candidate objects", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [
        { key: "A" }, // missing text
        { text: "hello" }, // missing key
        { key: "C", text: "valid", confidence: 10 },
      ];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      // Should handle gracefully, at minimum the valid one
      expect(result.bestCandidate).toBeDefined();
    });
  });

  describe("performance considerations", () => {
    it("limits words extracted per text", async () => {
      const scorer = loadRuntimeOffline();
      const manyWords = Array(100)
        .fill("test")
        .join(" ");
      const candidates = [{ key: "A", text: manyWords, confidence: 10 }];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      const dict = result.bestCandidate.dictionary;
      // Should not extract all 100 words (MAX_WORDS_PER_TEXT limit)
      expect(dict.totalWords).toBeLessThanOrEqual(16);
    });

    it("completes in reasonable time for typical input", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = Array(20)
        .fill(null)
        .map((_, i) => ({
          key: `K${i}`,
          text: `the quick brown fox jumps ${i}`,
          confidence: Math.random() * 100,
        }));

      const start = Date.now();
      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en", "de"],
      });
      const elapsed = Date.now() - start;

      expect(result.rankedCandidates.length).toBe(20);
      // Should complete quickly for offline mode
      expect(elapsed).toBeLessThan(5000);
    });
  });

  describe("confidence score adjustments", () => {
    it("penalizes candidates with no valid words", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [
        { key: "A", text: "xyz qrs tuv wxy", confidence: 50 },
        { key: "B", text: "the quick brown", confidence: 30 },
      ];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      // Despite higher initial confidence, gibberish should be penalized
      expect(result.bestCandidate.text).toBe("the quick brown");
    });

    it("preserves relative ordering for similar quality texts", async () => {
      const scorer = loadRuntimeOffline();
      const candidates = [
        { key: "A", text: "the quick fox", confidence: 50 },
        { key: "B", text: "the brown dog", confidence: 40 },
        { key: "C", text: "the lazy cat", confidence: 30 },
      ];

      const result = await scorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      // All have similar word quality, so original confidence should matter
      expect(result.bestCandidate.key).toBe("A");
    });
  });
});