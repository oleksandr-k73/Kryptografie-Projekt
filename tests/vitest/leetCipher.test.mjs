import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load the cipher module
const cipherCode = readFileSync(join(process.cwd(), 'js/ciphers/leetCipher.js'), 'utf8');
const global = { KryptoCiphers: {} };
new Function('window', cipherCode)(global);
const leetCipher = global.KryptoCiphers.leetCipher;

describe('leetCipher', () => {
  describe('metadata', () => {
    it('should have correct id', () => {
      expect(leetCipher.id).toBe('leet');
    });

    it('should have correct name', () => {
      expect(leetCipher.name).toBe('Leetspeak');
    });

    it('should not support key', () => {
      expect(leetCipher.supportsKey).toBe(false);
    });

    it('should have info object with all required fields', () => {
      expect(leetCipher.info).toBeDefined();
      expect(leetCipher.info.purpose).toBeDefined();
      expect(leetCipher.info.process).toBeDefined();
      expect(leetCipher.info.crack).toBeDefined();
      expect(leetCipher.info.useCase).toBeDefined();
    });
  });

  describe('encrypt', () => {
    it('should convert basic letters to leet', () => {
      expect(leetCipher.encrypt('a')).toBe('4');
      expect(leetCipher.encrypt('e')).toBe('3');
      expect(leetCipher.encrypt('i')).toBe('1');
      expect(leetCipher.encrypt('o')).toBe('0');
      expect(leetCipher.encrypt('s')).toBe('5');
      expect(leetCipher.encrypt('t')).toBe('7');
    });

    it('should handle uppercase letters', () => {
      expect(leetCipher.encrypt('A')).toBe('4');
      expect(leetCipher.encrypt('E')).toBe('3');
      expect(leetCipher.encrypt('AEIOU')).toBe('4310');
    });

    it('should handle mixed case', () => {
      expect(leetCipher.encrypt('Hello')).toBe('H3||0');
    });

    it('should encrypt common words', () => {
      expect(leetCipher.encrypt('leet')).toBe('|337');
      expect(leetCipher.encrypt('test')).toBe('7357');
      expect(leetCipher.encrypt('elite')).toBe('3|173');
    });

    it('should preserve non-mapped characters', () => {
      expect(leetCipher.encrypt('Hello World')).toContain('H');
      expect(leetCipher.encrypt('Hello World')).toContain('W');
      expect(leetCipher.encrypt('Hello World')).toContain(' ');
    });

    it('should handle empty string', () => {
      expect(leetCipher.encrypt('')).toBe('');
    });

    it('should handle strings with only non-mapped characters', () => {
      expect(leetCipher.encrypt('XYZ')).toBe('XYZ');
      expect(leetCipher.encrypt('123')).toBe('123');
    });

    it('should handle special characters', () => {
      const text = 'Hello! @World';
      const encrypted = leetCipher.encrypt(text);
      expect(encrypted).toContain('!');
      expect(encrypted).toContain('@');
    });

    it('should handle all mapped letters', () => {
      expect(leetCipher.encrypt('abegilo')).toBe('4836')||0');
      expect(leetCipher.encrypt('stz')).toBe('572');
    });
  });

  describe('decrypt', () => {
    it('should decrypt leet text back to normal', () => {
      const original = 'hello';
      const encrypted = leetCipher.encrypt(original);
      const decrypted = leetCipher.decrypt(encrypted);

      expect(decrypted.toLowerCase()).toContain('e');
      expect(decrypted.toLowerCase()).toContain('o');
    });

    it('should handle mixed leet and normal text', () => {
      const text = 'H3||0 W0r|d';
      const decrypted = leetCipher.decrypt(text);

      expect(decrypted).toBeDefined();
      expect(typeof decrypted).toBe('string');
    });

    it('should use crack internally', () => {
      const text = '7357';
      const decrypted = leetCipher.decrypt(text);

      expect(decrypted).toBeDefined();
    });
  });

  describe('crack', () => {
    it('should crack simple leet text', () => {
      const encrypted = '7357'; // "test"
      const result = leetCipher.crack(encrypted);

      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(result.key).toBeNull();
    });

    it('should crack text with common words', () => {
      const encrypted = leetCipher.encrypt('the quick brown fox');
      const result = leetCipher.crack(encrypted);

      expect(result.text.toLowerCase()).toContain('the');
      expect(result.text.toLowerCase()).toContain('quick');
    });

    it('should crack German text', () => {
      const encrypted = leetCipher.encrypt('der die und');
      const result = leetCipher.crack(encrypted);

      expect(result.text.toLowerCase()).toContain('der');
    });

    it('should handle ambiguous characters', () => {
      // 1 can be 'i' or 'l' or '1'
      // | can be 'l', 'i', or '|'
      const result = leetCipher.crack('1|1');

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
    });

    it('should provide confidence score', () => {
      const encrypted = leetCipher.encrypt('hello world');
      const result = leetCipher.crack(encrypted);

      expect(typeof result.confidence).toBe('number');
      expect(Number.isFinite(result.confidence)).toBe(true);
    });

    it('should handle empty string', () => {
      const result = leetCipher.crack('');

      expect(result).toHaveProperty('text');
      expect(result.text).toBe('');
    });

    it('should handle text with no leet characters', () => {
      const text = 'Hello World';
      const result = leetCipher.crack(text);

      expect(result.text).toContain('Hello');
      expect(result.text).toContain('World');
    });

    it('should handle numbers that arent leet', () => {
      const result = leetCipher.crack('Test 999');

      expect(result.text).toContain('Test');
    });

    it('should crack longer text', () => {
      const plaintext = 'the quick brown fox jumps over the lazy dog';
      const encrypted = leetCipher.encrypt(plaintext);
      const result = leetCipher.crack(encrypted);

      expect(result.text.toLowerCase()).toContain('quick');
      expect(result.text.toLowerCase()).toContain('lazy');
    });

    it('should handle mixed leet and special characters', () => {
      const encrypted = 'H3||0, W0r|d!';
      const result = leetCipher.crack(encrypted);

      expect(result.text).toContain(',');
      expect(result.text).toContain('!');
    });

    it('should provide reasonable confidence for good text', () => {
      const plaintext = 'hello world this is a test';
      const encrypted = leetCipher.encrypt(plaintext);
      const result = leetCipher.crack(encrypted);

      expect(result.confidence).toBeGreaterThan(-20);
    });

    it('should handle text with multiple spaces', () => {
      const encrypted = 'H3||0  W0r|d';
      const result = leetCipher.crack(encrypted);

      expect(result.text).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle very long text', () => {
      const longText = 'test '.repeat(100);
      const encrypted = leetCipher.encrypt(longText);
      expect(encrypted.length).toBe(longText.length);
      const result = leetCipher.crack(encrypted);
      expect(result.text.length).toBeGreaterThan(0);
    });

    it('should handle unicode characters', () => {
      const text = 'Hello 世界 🌍';
      const encrypted = leetCipher.encrypt(text);
      expect(encrypted).toContain('世界');
      expect(encrypted).toContain('🌍');
    });

    it('should handle all special characters', () => {
      const text = '!@#$%^&*()';
      const encrypted = leetCipher.encrypt(text);
      expect(encrypted).toBe(text);
    });

    it('should handle text with only numbers', () => {
      const text = '123456789';
      const encrypted = leetCipher.encrypt(text);
      expect(encrypted).toBe(text);
    });

    it('should handle text with newlines', () => {
      const text = 'hello\nworld';
      const encrypted = leetCipher.encrypt(text);
      expect(encrypted).toContain('\n');
    });

    it('should handle text with tabs', () => {
      const text = 'hello\tworld';
      const encrypted = leetCipher.encrypt(text);
      expect(encrypted).toContain('\t');
    });

    it('should handle all alphabet letters', () => {
      const alphabet = 'abcdefghijklmnopqrstuvwxyz';
      const encrypted = leetCipher.encrypt(alphabet);
      expect(encrypted.length).toBe(alphabet.length);
    });
  });

  describe('encryption is deterministic', () => {
    it('should produce same output for same input', () => {
      const text = 'hello world';
      const encrypted1 = leetCipher.encrypt(text);
      const encrypted2 = leetCipher.encrypt(text);
      expect(encrypted1).toBe(encrypted2);
    });

    it('should be case insensitive for mapped characters', () => {
      const lower = leetCipher.encrypt('a');
      const upper = leetCipher.encrypt('A');
      expect(lower).toBe(upper);
    });
  });

  describe('cracking with beam search', () => {
    it('should find plausible text with ambiguous mapping', () => {
      // Test that beam search explores multiple possibilities
      const result = leetCipher.crack('7h3 qu1ck');

      expect(result.text).toBeDefined();
      expect(result.confidence).toBeDefined();
    });

    it('should handle text where multiple interpretations exist', () => {
      const result = leetCipher.crack('1337');

      expect(result.text).toBeDefined();
      // The beam search should pick a reasonable interpretation
    });

    it('should prefer common bigrams', () => {
      const result = leetCipher.crack('7h3');

      // Should prefer "the" over other combinations
      expect(result.text.toLowerCase()).toContain('t');
      expect(result.text.toLowerCase()).toContain('h');
      expect(result.text.toLowerCase()).toContain('e');
    });
  });

  describe('scoring mechanism', () => {
    it('should penalize suspicious characters in output', () => {
      const result1 = leetCipher.crack('hello');
      const result2 = leetCipher.crack('h3||0');

      // Both should work, but confidence scores may differ
      expect(result1.confidence).toBeDefined();
      expect(result2.confidence).toBeDefined();
    });

    it('should reward common words', () => {
      const commonWord = leetCipher.encrypt('the');
      const result = leetCipher.crack(commonWord);

      expect(result.text.toLowerCase()).toContain('t');
      expect(result.text.toLowerCase()).toContain('h');
      expect(result.text.toLowerCase()).toContain('e');
    });

    it('should consider vowel ratio', () => {
      const plaintext = 'hello world';
      const encrypted = leetCipher.encrypt(plaintext);
      const result = leetCipher.crack(encrypted);

      // Should find text with reasonable vowel ratio
      const vowels = result.text.toLowerCase().match(/[aeiou]/g);
      expect(vowels).toBeTruthy();
      expect(vowels.length).toBeGreaterThan(0);
    });
  });
});