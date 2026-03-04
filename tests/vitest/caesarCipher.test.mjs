import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load the cipher module by evaluating it in a context
const cipherCode = readFileSync(join(process.cwd(), 'js/ciphers/caesarCipher.js'), 'utf8');
const global = { KryptoCiphers: {} };
new Function('window', cipherCode)(global);
const caesarCipher = global.KryptoCiphers.caesarCipher;

describe('caesarCipher', () => {
  describe('metadata', () => {
    it('should have correct id', () => {
      expect(caesarCipher.id).toBe('caesar');
    });

    it('should have correct name', () => {
      expect(caesarCipher.name).toBe('Cäsar');
    });

    it('should support key', () => {
      expect(caesarCipher.supportsKey).toBe(true);
    });

    it('should have info object with all required fields', () => {
      expect(caesarCipher.info).toBeDefined();
      expect(caesarCipher.info.purpose).toBeDefined();
      expect(caesarCipher.info.process).toBeDefined();
      expect(caesarCipher.info.crack).toBeDefined();
      expect(caesarCipher.info.useCase).toBeDefined();
    });
  });

  describe('parseKey', () => {
    it('should parse valid integer key', () => {
      expect(caesarCipher.parseKey('3')).toBe(3);
      expect(caesarCipher.parseKey('13')).toBe(13);
      expect(caesarCipher.parseKey('25')).toBe(25);
    });

    it('should parse negative keys', () => {
      expect(caesarCipher.parseKey('-3')).toBe(-3);
      expect(caesarCipher.parseKey('-13')).toBe(-13);
    });

    it('should parse zero', () => {
      expect(caesarCipher.parseKey('0')).toBe(0);
    });

    it('should throw error for non-numeric input', () => {
      expect(() => caesarCipher.parseKey('abc')).toThrow('Schlüssel muss eine ganze Zahl sein');
      expect(() => caesarCipher.parseKey('')).toThrow('Schlüssel muss eine ganze Zahl sein');
    });

    it('should throw error for float input', () => {
      expect(() => caesarCipher.parseKey('3.5')).toThrow('Schlüssel muss eine ganze Zahl sein');
    });
  });

  describe('encrypt', () => {
    it('should encrypt lowercase letters with positive shift', () => {
      expect(caesarCipher.encrypt('abc', 3)).toBe('def');
      expect(caesarCipher.encrypt('xyz', 3)).toBe('abc');
    });

    it('should encrypt uppercase letters with positive shift', () => {
      expect(caesarCipher.encrypt('ABC', 3)).toBe('DEF');
      expect(caesarCipher.encrypt('XYZ', 3)).toBe('ABC');
    });

    it('should encrypt mixed case', () => {
      expect(caesarCipher.encrypt('Hello', 3)).toBe('Khoor');
      expect(caesarCipher.encrypt('AbCdEf', 5)).toBe('FgHiJk');
    });

    it('should preserve non-alphabetic characters', () => {
      expect(caesarCipher.encrypt('Hello, World!', 3)).toBe('Khoor, Zruog!');
      expect(caesarCipher.encrypt('Test 123', 5)).toBe('Yjxy 123');
    });

    it('should handle zero shift', () => {
      expect(caesarCipher.encrypt('Hello', 0)).toBe('Hello');
    });

    it('should handle negative shift', () => {
      expect(caesarCipher.encrypt('def', -3)).toBe('abc');
      expect(caesarCipher.encrypt('ABC', -3)).toBe('XYZ');
    });

    it('should handle shift larger than 26', () => {
      expect(caesarCipher.encrypt('abc', 29)).toBe('def'); // 29 % 26 = 3
      expect(caesarCipher.encrypt('abc', 52)).toBe('abc'); // 52 % 26 = 0
    });

    it('should handle empty string', () => {
      expect(caesarCipher.encrypt('', 3)).toBe('');
    });

    it('should handle strings with only non-alphabetic characters', () => {
      expect(caesarCipher.encrypt('123 !@#', 3)).toBe('123 !@#');
    });
  });

  describe('decrypt', () => {
    it('should decrypt lowercase letters', () => {
      expect(caesarCipher.decrypt('def', 3)).toBe('abc');
      expect(caesarCipher.decrypt('abc', 3)).toBe('xyz');
    });

    it('should decrypt uppercase letters', () => {
      expect(caesarCipher.decrypt('DEF', 3)).toBe('ABC');
      expect(caesarCipher.decrypt('ABC', 3)).toBe('XYZ');
    });

    it('should decrypt mixed case', () => {
      expect(caesarCipher.decrypt('Khoor', 3)).toBe('Hello');
    });

    it('should preserve non-alphabetic characters', () => {
      expect(caesarCipher.decrypt('Khoor, Zruog!', 3)).toBe('Hello, World!');
    });

    it('should be inverse of encrypt', () => {
      const plaintext = 'Hello, World!';
      const key = 13;
      const encrypted = caesarCipher.encrypt(plaintext, key);
      const decrypted = caesarCipher.decrypt(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle ROT13 (shift 13)', () => {
      const text = 'Hello, World!';
      const encrypted = caesarCipher.encrypt(text, 13);
      const decrypted = caesarCipher.decrypt(encrypted, 13);
      expect(decrypted).toBe(text);
    });

    it('should handle negative shift', () => {
      expect(caesarCipher.decrypt('abc', -3)).toBe('def');
    });
  });

  describe('crack', () => {
    it('should crack simple Caesar cipher with common words', () => {
      const encrypted = caesarCipher.encrypt('der die und', 5);
      const result = caesarCipher.crack(encrypted);

      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('candidates');

      expect(result.key).toBe(5);
      expect(result.text.toLowerCase()).toContain('der');
    });

    it('should crack English text', () => {
      const encrypted = caesarCipher.encrypt('the quick brown fox', 7);
      const result = caesarCipher.crack(encrypted);

      expect(result.key).toBe(7);
      expect(result.text.toLowerCase()).toContain('the');
      expect(result.text.toLowerCase()).toContain('quick');
    });

    it('should return candidates array', () => {
      const encrypted = caesarCipher.encrypt('hello world', 3);
      const result = caesarCipher.crack(encrypted);

      expect(Array.isArray(result.candidates)).toBe(true);
      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.candidates.length).toBeLessThanOrEqual(8);
    });

    it('should have candidates sorted by confidence', () => {
      const encrypted = caesarCipher.encrypt('hello world', 3);
      const result = caesarCipher.crack(encrypted);

      for (let i = 1; i < result.candidates.length; i++) {
        expect(result.candidates[i - 1].confidence).toBeGreaterThanOrEqual(
          result.candidates[i].confidence
        );
      }
    });

    it('should handle text with no clear solution', () => {
      const result = caesarCipher.crack('xyz123');

      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
    });

    it('should crack longer text accurately', () => {
      const plaintext = 'Die klassische Verschlüsselung ist nicht sehr sicher aber interessant';
      const encrypted = caesarCipher.encrypt(plaintext, 11);
      const result = caesarCipher.crack(encrypted);

      expect(result.key).toBe(11);
      expect(result.text.toLowerCase()).toContain('klassisch');
    });

    it('should handle empty string', () => {
      const result = caesarCipher.crack('');

      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('text');
    });

    it('should handle text with special characters', () => {
      const encrypted = caesarCipher.encrypt('Hello! World?', 5);
      const result = caesarCipher.crack(encrypted);

      expect(result.key).toBe(5);
      expect(result.text).toContain('!');
      expect(result.text).toContain('?');
    });

    it('should crack text with umlauts preserved', () => {
      const text = 'Hallo Welt Ümläüte';
      const encrypted = caesarCipher.encrypt(text, 3);
      const result = caesarCipher.crack(encrypted);

      expect(result.key).toBe(3);
      // Umlauts should be preserved since they're not shifted
      expect(result.text).toContain('Ü');
    });

    it('should provide reasonable confidence scores', () => {
      const plaintext = 'the quick brown fox jumps over the lazy dog';
      const encrypted = caesarCipher.encrypt(plaintext, 7);
      const result = caesarCipher.crack(encrypted);

      expect(result.key).toBe(7);
      expect(result.confidence).toBeGreaterThan(-10);
    });
  });

  describe('edge cases', () => {
    it('should handle very long text', () => {
      const longText = 'a'.repeat(10000);
      const encrypted = caesarCipher.encrypt(longText, 5);
      expect(encrypted).toBe('f'.repeat(10000));
    });

    it('should handle unicode characters', () => {
      const text = 'Hello 世界 🌍';
      const encrypted = caesarCipher.encrypt(text, 3);
      expect(encrypted).toContain('世界');
      expect(encrypted).toContain('🌍');
    });

    it('should handle all alphabet letters', () => {
      const alphabet = 'abcdefghijklmnopqrstuvwxyz';
      const encrypted = caesarCipher.encrypt(alphabet, 1);
      expect(encrypted).toBe('bcdefghijklmnopqrstuvwxyza');
    });

    it('should handle shift equal to 26', () => {
      const text = 'Hello';
      const encrypted = caesarCipher.encrypt(text, 26);
      expect(encrypted).toBe('Hello'); // 26 % 26 = 0
    });

    it('should handle large negative shift', () => {
      const text = 'abc';
      const encrypted = caesarCipher.encrypt(text, -29);
      expect(encrypted).toBe('xyz'); // -29 % 26 = -3, which is equivalent to 23
    });
  });

  describe('round-trip encryption/decryption', () => {
    it('should handle round-trip with various keys', () => {
      const plaintext = 'The Quick Brown Fox';
      const keys = [1, 3, 5, 7, 13, 25];

      for (const key of keys) {
        const encrypted = caesarCipher.encrypt(plaintext, key);
        const decrypted = caesarCipher.decrypt(encrypted, key);
        expect(decrypted).toBe(plaintext);
      }
    });

    it('should handle round-trip with negative keys', () => {
      const plaintext = 'Test Message';
      const encrypted = caesarCipher.encrypt(plaintext, -7);
      const decrypted = caesarCipher.decrypt(encrypted, -7);
      expect(decrypted).toBe(plaintext);
    });
  });
});