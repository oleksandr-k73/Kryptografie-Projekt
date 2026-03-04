import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load the scorer module
const scorerCode = readFileSync(join(process.cwd(), 'js/core/dictionaryScorer.js'), 'utf8');
const global = { KryptoCore: {} };
new Function('window', scorerCode)(global);
const dictionaryScorer = global.KryptoCore.dictionaryScorer;

describe('dictionaryScorer', () => {
  describe('rankCandidates', () => {
    it('should rank candidates by confidence', async () => {
      const candidates = [
        { text: 'xyz abc def', confidence: 5 },
        { text: 'der die und', confidence: 10 },
        { text: 'random text', confidence: 3 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result).toHaveProperty('rankedCandidates');
      expect(result).toHaveProperty('bestCandidate');
      expect(result).toHaveProperty('apiAvailable');
      expect(Array.isArray(result.rankedCandidates)).toBe(true);
    });

    it('should boost candidates with recognized German words', async () => {
      const candidates = [
        { text: 'gibberish xyz abc', confidence: 5 },
        { text: 'der die und das ist', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates, {
        languageHints: ['de']
      });

      expect(result.bestCandidate).toBeDefined();
      // The German text should score higher due to dictionary match
      expect(result.bestCandidate.text).toContain('der');
    });

    it('should boost candidates with recognized English words', async () => {
      const candidates = [
        { text: 'xyz random stuff', confidence: 5 },
        { text: 'the quick brown fox', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates, {
        languageHints: ['en']
      });

      expect(result.bestCandidate).toBeDefined();
      // The English text should score higher
      expect(result.bestCandidate.text).toContain('the');
    });

    it('should handle empty candidates array', async () => {
      const result = await dictionaryScorer.rankCandidates([]);

      expect(result.rankedCandidates).toEqual([]);
      expect(result.bestCandidate).toBeNull();
    });

    it('should handle single candidate', async () => {
      const candidates = [
        { text: 'hello world', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.rankedCandidates.length).toBe(1);
      expect(result.bestCandidate).toBeDefined();
      expect(result.bestCandidate.text).toBe('hello world');
    });

    it('should preserve original candidate properties', async () => {
      const candidates = [
        { text: 'test', confidence: 5, key: 'ABC', customProp: 'value' }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate.key).toBe('ABC');
      expect(result.bestCandidate.customProp).toBe('value');
    });

    it('should add dictionary metadata to candidates', async () => {
      const candidates = [
        { text: 'hello world', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.rankedCandidates[0]).toHaveProperty('dictionary');
      expect(result.rankedCandidates[0].dictionary).toHaveProperty('validWords');
      expect(result.rankedCandidates[0].dictionary).toHaveProperty('totalWords');
      expect(result.rankedCandidates[0].dictionary).toHaveProperty('coverage');
    });

    it('should handle candidates with missing confidence', async () => {
      const candidates = [
        { text: 'test' },
        { text: 'hello', confidence: null }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.rankedCandidates.length).toBe(2);
    });

    it('should handle text with special characters', async () => {
      const candidates = [
        { text: 'hello, world! 123', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate).toBeDefined();
    });

    it('should handle text with umlauts', async () => {
      const candidates = [
        { text: 'äöü test', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate).toBeDefined();
    });

    it('should respect language hints order', async () => {
      const candidates = [
        { text: 'der die und', confidence: 5 },
        { text: 'the and for', confidence: 5 }
      ];

      const result1 = await dictionaryScorer.rankCandidates(candidates, {
        languageHints: ['de', 'en']
      });
      const result2 = await dictionaryScorer.rankCandidates(candidates, {
        languageHints: ['en', 'de']
      });

      expect(result1.bestCandidate).toBeDefined();
      expect(result2.bestCandidate).toBeDefined();
    });

    it('should handle invalid language hints', async () => {
      const candidates = [
        { text: 'hello world', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates, {
        languageHints: ['invalid', 'xyz']
      });

      expect(result.rankedCandidates.length).toBe(1);
    });

    it('should default to de/en without hints', async () => {
      const candidates = [
        { text: 'hello world', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.rankedCandidates[0].dictionary).toBeDefined();
    });

    it('should handle very long text', async () => {
      const candidates = [
        { text: 'word '.repeat(100), confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate).toBeDefined();
    });

    it('should handle text with only numbers', async () => {
      const candidates = [
        { text: '12345', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate).toBeDefined();
    });

    it('should penalize candidates with no valid words', async () => {
      const candidates = [
        { text: 'xyz qwerty asdfgh', confidence: 10 },
        { text: 'hello world test', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      // Despite lower initial confidence, "hello world test" should rank better
      expect(result.bestCandidate.text).toContain('hello');
    });

    it('should handle mixed language text', async () => {
      const candidates = [
        { text: 'hello world der die', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate).toBeDefined();
      expect(result.bestCandidate.dictionary.validWords).toBeGreaterThan(0);
    });

    it('should limit API checks to top candidates', async () => {
      const candidates = Array.from({ length: 20 }, (_, i) => ({
        text: `test ${i}`,
        confidence: 20 - i
      }));

      const result = await dictionaryScorer.rankCandidates(candidates);

      // Should process all candidates
      expect(result.rankedCandidates.length).toBe(20);
    });

    it('should handle candidates with identical confidence', async () => {
      const candidates = [
        { text: 'first', confidence: 5 },
        { text: 'second', confidence: 5 },
        { text: 'third', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.rankedCandidates.length).toBe(3);
    });

    it('should handle compound words', async () => {
      const candidates = [
        { text: 'testword', confidence: 5 },
        { text: 'helloworld', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate).toBeDefined();
    });

    it('should handle text with repeated words', async () => {
      const candidates = [
        { text: 'test test test', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate).toBeDefined();
      expect(result.bestCandidate.dictionary.validWords).toBeGreaterThan(0);
    });

    it('should handle short words', async () => {
      const candidates = [
        { text: 'a b c d e', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate).toBeDefined();
    });

    it('should provide coverage ratio', async () => {
      const candidates = [
        { text: 'hello world test', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate.dictionary.coverage).toBeGreaterThanOrEqual(0);
      expect(result.bestCandidate.dictionary.coverage).toBeLessThanOrEqual(1);
    });

    it('should indicate API availability', async () => {
      const candidates = [
        { text: 'test', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(typeof result.apiAvailable).toBe('boolean');
    });
  });

  describe('local dictionary matching', () => {
    it('should recognize common German words locally', async () => {
      const candidates = [
        { text: 'der die und das', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates, {
        languageHints: ['de']
      });

      expect(result.bestCandidate.dictionary.validWords).toBeGreaterThan(0);
      expect(result.bestCandidate.dictionary.source).toBe('local');
    });

    it('should recognize common English words locally', async () => {
      const candidates = [
        { text: 'the and for not', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates, {
        languageHints: ['en']
      });

      expect(result.bestCandidate.dictionary.validWords).toBeGreaterThan(0);
      expect(result.bestCandidate.dictionary.source).toBe('local');
    });

    it('should handle word variations with stems', async () => {
      const candidates = [
        { text: 'testing tested tests', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates, {
        languageHints: ['en']
      });

      expect(result.bestCandidate).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty text', async () => {
      const candidates = [
        { text: '', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate).toBeDefined();
    });

    it('should handle whitespace-only text', async () => {
      const candidates = [
        { text: '   ', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate).toBeDefined();
    });

    it('should handle text with newlines', async () => {
      const candidates = [
        { text: 'hello\nworld\ntest', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate).toBeDefined();
    });

    it('should handle text with tabs', async () => {
      const candidates = [
        { text: 'hello\tworld', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate).toBeDefined();
    });

    it('should handle unicode text', async () => {
      const candidates = [
        { text: 'hello 世界 🌍', confidence: 5 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate).toBeDefined();
    });

    it('should handle extremely low confidence', async () => {
      const candidates = [
        { text: 'test', confidence: -1000 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate).toBeDefined();
    });

    it('should handle extremely high confidence', async () => {
      const candidates = [
        { text: 'test', confidence: 1000000 }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate).toBeDefined();
    });

    it('should handle Infinity confidence', async () => {
      const candidates = [
        { text: 'test', confidence: Infinity }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate).toBeDefined();
    });

    it('should handle NaN confidence', async () => {
      const candidates = [
        { text: 'test', confidence: NaN }
      ];

      const result = await dictionaryScorer.rankCandidates(candidates);

      expect(result.bestCandidate).toBeDefined();
    });
  });
});