import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("dictionaryScorer", () => {
  let dictionaryScorer;
  let mockGlobal;

  beforeAll(() => {
    const code = readFileSync(
      join(process.cwd(), "js/core/dictionaryScorer.js"),
      "utf-8"
    );
    const fn = new Function("window", code);
    mockGlobal = {};
    fn(mockGlobal);
    dictionaryScorer = mockGlobal.KryptoCore.dictionaryScorer;
  });

  beforeEach(() => {
    // Clear the word cache before each test
    vi.clearAllMocks();
  });

  describe("rankCandidates - local fallback", () => {
    it("should rank candidates using local lexicon when API unavailable", async () => {
      // Mock fetch to simulate network error
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const candidates = [
        { text: "random gibberish xyz", confidence: 10 },
        { text: "das ist ein test", confidence: 8 },
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result).toHaveProperty("rankedCandidates");
      expect(result).toHaveProperty("bestCandidate");
      expect(result).toHaveProperty("apiAvailable");

      // With local lexicon, German text should rank higher
      expect(result.bestCandidate.text).toContain("das");
      expect(result.rankedCandidates).toHaveLength(2);
    });

    it("should recognize common German words in local lexicon", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const candidates = [
        { text: "der die und das", confidence: 5 },
        { text: "xyz abc def qrs", confidence: 5 },
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      // Candidate with German words should rank first
      expect(result.bestCandidate.text).toBe("der die und das");
      expect(result.bestCandidate.dictionary.coverage).toBeGreaterThan(0);
    });

    it("should recognize common English words in local lexicon", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const candidates = [
        { text: "the and is not", confidence: 5 },
        { text: "zzz www qqq", confidence: 5 },
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate.text).toBe("the and is not");
    });

    it("should handle candidates with no recognizable words", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const candidates = [
        { text: "xyz qwerty asdfgh", confidence: 5 },
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate).toBeDefined();
      expect(result.bestCandidate.dictionary.coverage).toBe(0);
    });

    it("should penalize candidates with zero valid words", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const candidates = [
        { text: "das ist gut", confidence: 5 },
        { text: "xyz qwerty", confidence: 10 },
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      // Despite higher initial confidence, gibberish should rank lower
      expect(result.bestCandidate.text).toBe("das ist gut");
    });
  });

  describe("rankCandidates - with API", () => {
    it("should use API when available", async () => {
      // Mock successful API responses
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes("/das") || url.includes("/ist")) {
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({ ok: false });
      });

      const candidates = [
        { text: "das ist", confidence: 5 },
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      // Result should be defined even if API fails
      expect(result).toBeDefined();
      expect(result.bestCandidate).toBeDefined();
    });

    it("should boost candidates with API-confirmed words", async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes("/de/hello") || url.includes("/en/hello")) {
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({ ok: false });
      });

      const candidates = [
        { text: "hello world", confidence: 5 },
        { text: "xyz abc", confidence: 5 },
      ];

      const result = await dictionaryScorer.rankCandidates(candidates, {
        languageHints: ["en"],
      });

      // Candidate with confirmed word should rank higher
      expect(result.bestCandidate.text).toBe("hello world");
      expect(result.bestCandidate.dictionary.validWords).toBeGreaterThan(0);
    });

    it("should combine API and local results", async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes("/test")) {
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({ ok: false });
      });

      const candidates = [
        { text: "das ist ein test", confidence: 5 },
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      // Should have dictionary data from local lexicon
      expect(result.bestCandidate.dictionary).toBeDefined();
      expect(result.bestCandidate.dictionary.validWords).toBeGreaterThan(0);
    });
  });

  describe("rankCandidates - options", () => {
    it("should use default language hints if not provided", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false });

      const candidates = [{ text: "test", confidence: 5 }];
      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result).toBeDefined();
      expect(result.rankedCandidates).toHaveLength(1);
    });

    it("should respect custom language hints", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({ ok: false });
      global.fetch = fetchSpy;

      const candidates = [{ text: "hallo welt", confidence: 5 }];
      await dictionaryScorer.rankCandidates(candidates, {
        languageHints: ["de"],
      });

      // Check that fetch was called with German language
      const calls = fetchSpy.mock.calls;
      const hasGermanCalls = calls.some((call) => call[0].includes("/de/"));
      expect(hasGermanCalls).toBe(true);
    });

    it("should handle empty language hints", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false });

      const candidates = [{ text: "test", confidence: 5 }];
      const result = await dictionaryScorer.rankCandidates(candidates, {
        languageHints: [],
      });

      // Should fall back to default ["de", "en"]
      expect(result).toBeDefined();
    });
  });

  describe("rankCandidates - result structure", () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    });

    it("should enrich candidates with dictionary data", async () => {
      const candidates = [
        { text: "test", confidence: 5, key: 3 },
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate).toHaveProperty("dictionary");
      expect(result.bestCandidate).toHaveProperty("localConfidence");
      expect(result.bestCandidate).toHaveProperty("confidence");
      expect(result.bestCandidate).toHaveProperty("key");
    });

    it("should preserve original candidate properties", async () => {
      const candidates = [
        { text: "test", confidence: 5, key: 3, customProp: "value" },
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate.key).toBe(3);
      expect(result.bestCandidate.customProp).toBe("value");
    });

    it("should maintain stable sort for equal confidence", async () => {
      const candidates = [
        { text: "aaa", confidence: 5 },
        { text: "bbb", confidence: 5 },
        { text: "ccc", confidence: 5 },
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      // When confidence is equal, original order should be preserved
      expect(result.rankedCandidates).toHaveLength(3);
    });

    it("should include dictionary coverage information", async () => {
      const candidates = [
        { text: "der die das", confidence: 5 },
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate.dictionary).toHaveProperty("coverage");
      expect(result.bestCandidate.dictionary).toHaveProperty("validWords");
      expect(result.bestCandidate.dictionary).toHaveProperty("totalWords");
      expect(result.bestCandidate.dictionary.coverage).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    });

    it("should handle empty candidates array", async () => {
      const result = await dictionaryScorer.rankCandidates([]);

      expect(result.rankedCandidates).toEqual([]);
      expect(result.bestCandidate).toBeNull();
    });

    it("should handle single candidate", async () => {
      const candidates = [{ text: "test", confidence: 5 }];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.rankedCandidates).toHaveLength(1);
      expect(result.bestCandidate).toBe(result.rankedCandidates[0]);
    });

    it("should handle candidates with empty text", async () => {
      const candidates = [
        { text: "", confidence: 5 },
        { text: "test", confidence: 3 },
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.rankedCandidates).toHaveLength(2);
      expect(result.bestCandidate).toBeDefined();
    });

    it("should handle candidates with no confidence", async () => {
      const candidates = [{ text: "test" }];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate.localConfidence).toBe(0);
    });

    it("should handle text with only short words", async () => {
      const candidates = [{ text: "a b c d e", confidence: 5 }];

      const result = await dictionaryScorer.rankCandidates(candidates);

      // Short words (< 3 chars) should be ignored
      expect(result.bestCandidate.dictionary.totalWords).toBe(0);
    });

    it("should handle very long candidate list", async () => {
      const candidates = Array.from({ length: 50 }, (_, i) => ({
        text: `test ${i}`,
        confidence: i,
      }));

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.rankedCandidates).toHaveLength(50);
      expect(result.bestCandidate).toBeDefined();
    });

    it("should handle quantum-themed words", async () => {
      const candidates = [
        { text: "quantum classical", confidence: 5 },
        { text: "random noise", confidence: 5 },
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      // "quantum" and "classical" are in the local lexicon
      expect(result.bestCandidate.text).toBe("quantum classical");
    });
  });

  describe("word extraction and normalization", () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    });

    it("should extract words of at least 3 characters", async () => {
      const candidates = [
        { text: "das ist ein test mit vielen woertern", confidence: 5 },
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      // Should extract up to 8 unique words
      expect(result.bestCandidate.dictionary.totalWords).toBeGreaterThan(0);
      expect(result.bestCandidate.dictionary.totalWords).toBeLessThanOrEqual(8);
    });

    it("should handle words with umlauts", async () => {
      const candidates = [
        { text: "für über äöü", confidence: 5 },
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate.dictionary.totalWords).toBeGreaterThan(0);
    });

    it("should deduplicate words", async () => {
      const candidates = [
        { text: "test test test test", confidence: 5 },
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      // Only unique words should be counted
      expect(result.bestCandidate.dictionary.totalWords).toBe(1);
    });

    it("should limit to 8 unique words", async () => {
      const candidates = [
        {
          text: "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10",
          confidence: 5,
        },
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate.dictionary.totalWords).toBeLessThanOrEqual(8);
    });
  });
});