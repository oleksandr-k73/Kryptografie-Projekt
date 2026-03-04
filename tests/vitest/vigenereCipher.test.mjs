import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load the cipher module
const cipherCode = readFileSync(join(process.cwd(), 'js/ciphers/vigenereCipher.js'), 'utf8');
const global = { KryptoCiphers: {} };
new Function('window', cipherCode)(global);
const vigenereCipher = global.KryptoCiphers.vigenereCipher;

describe('vigenereCipher', () => {
  describe('metadata', () => {
    it('should have correct id', () => {
      expect(vigenereCipher.id).toBe('vigenere');
    });

    it('should have correct name', () => {
      expect(vigenereCipher.name).toBe('Vigenère');
    });

    it('should support key', () => {
      expect(vigenereCipher.supportsKey).toBe(true);
    });

    it('should support crack length hint', () => {
      expect(vigenereCipher.supportsCrackLengthHint).toBe(true);
    });

    it('should have info object with all required fields', () => {
      expect(vigenereCipher.info).toBeDefined();
      expect(vigenereCipher.info.purpose).toBeDefined();
      expect(vigenereCipher.info.process).toBeDefined();
      expect(vigenereCipher.info.crack).toBeDefined();
      expect(vigenereCipher.info.useCase).toBeDefined();
    });
  });

  describe('parseKey', () => {
    it('should parse valid alphabetic key', () => {
      expect(vigenereCipher.parseKey('LEMON')).toBe('LEMON');
      expect(vigenereCipher.parseKey('ABC')).toBe('ABC');
    });

    it('should convert lowercase to uppercase', () => {
      expect(vigenereCipher.parseKey('lemon')).toBe('LEMON');
      expect(vigenereCipher.parseKey('AbC')).toBe('ABC');
    });

    it('should handle German umlauts', () => {
      expect(vigenereCipher.parseKey('Ä')).toBe('AE');
      expect(vigenereCipher.parseKey('Ö')).toBe('OE');
      expect(vigenereCipher.parseKey('Ü')).toBe('UE');
      expect(vigenereCipher.parseKey('ß')).toBe('SS');
    });

    it('should strip non-alphabetic characters', () => {
      expect(vigenereCipher.parseKey('LE-MON')).toBe('LEMON');
      expect(vigenereCipher.parseKey('AB C')).toBe('ABC');
      expect(vigenereCipher.parseKey('KEY123')).toBe('KEY');
    });

    it('should throw error for empty key', () => {
      expect(() => vigenereCipher.parseKey('')).toThrow('Schlüssel muss mindestens einen Buchstaben enthalten');
      expect(() => vigenereCipher.parseKey('123')).toThrow('Schlüssel muss mindestens einen Buchstaben enthalten');
      expect(() => vigenereCipher.parseKey('!@#')).toThrow('Schlüssel muss mindestens einen Buchstaben enthalten');
    });
  });

  describe('encrypt', () => {
    it('should encrypt simple text with simple key', () => {
      const plaintext = 'ATTACKATDAWN';
      const key = 'LEMON';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      expect(encrypted).toBe('LXFOPVEFRNHR');
    });

    it('should handle lowercase input', () => {
      const plaintext = 'attackatdawn';
      const key = 'LEMON';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      expect(encrypted).toBe('lxfopvefrnhr');
    });

    it('should handle mixed case', () => {
      const plaintext = 'AttackAtDawn';
      const key = 'LEMON';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      expect(encrypted).toBe('LxfopvEfRnhr');
    });

    it('should preserve spaces and punctuation', () => {
      const plaintext = 'Attack at dawn!';
      const key = 'LEMON';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      expect(encrypted).toContain(' ');
      expect(encrypted).toContain('!');
    });

    it('should handle single character key', () => {
      const plaintext = 'HELLO';
      const key = 'A';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      expect(encrypted).toBe('HELLO'); // A is shift 0
    });

    it('should handle key shorter than text', () => {
      const plaintext = 'HELLOWORLD';
      const key = 'KEY';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      expect(encrypted.length).toBe(plaintext.length);
    });

    it('should handle key longer than text', () => {
      const plaintext = 'HI';
      const key = 'VERYLONGKEY';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      expect(encrypted.length).toBe(plaintext.length);
    });

    it('should handle empty text', () => {
      expect(vigenereCipher.encrypt('', 'KEY')).toBe('');
    });

    it('should not shift non-alphabetic characters', () => {
      const plaintext = '123 !@#';
      const key = 'KEY';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      expect(encrypted).toBe('123 !@#');
    });
  });

  describe('decrypt', () => {
    it('should decrypt text encrypted with same key', () => {
      const plaintext = 'ATTACKATDAWN';
      const key = 'LEMON';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      const decrypted = vigenereCipher.decrypt(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle lowercase encrypted text', () => {
      const plaintext = 'attackatdawn';
      const key = 'LEMON';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      const decrypted = vigenereCipher.decrypt(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt mixed case', () => {
      const plaintext = 'Hello World';
      const key = 'SECRET';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      const decrypted = vigenereCipher.decrypt(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it('should preserve spaces and punctuation', () => {
      const plaintext = 'Hello, World!';
      const key = 'KEY';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      const decrypted = vigenereCipher.decrypt(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('crack', () => {
    it('should crack simple Vigenere cipher with hint', () => {
      const plaintext = 'the quick brown fox jumps over the lazy dog';
      const key = 'KEY';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      const result = vigenereCipher.crack(encrypted, { keyLength: 3 });

      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('candidates');
      expect(result.key).toBe(key);
    });

    it('should crack without key length hint', () => {
      const plaintext = 'the quick brown fox jumps over the lazy dog';
      const key = 'ABC';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      const result = vigenereCipher.crack(encrypted);

      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('text');
      expect(result.text.toLowerCase()).toContain('the');
      expect(result.text.toLowerCase()).toContain('quick');
    });

    it('should crack German text', () => {
      const plaintext = 'der die und das ist nicht';
      const key = 'HAUS';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      const result = vigenereCipher.crack(encrypted, { keyLength: 4 });

      expect(result.key).toBe(key);
      expect(result.text.toLowerCase()).toContain('der');
    });

    it('should return candidates array', () => {
      const plaintext = 'hello world this is a test';
      const key = 'AB';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      const result = vigenereCipher.crack(encrypted, { keyLength: 2 });

      expect(Array.isArray(result.candidates)).toBe(true);
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it('should have search metadata', () => {
      const plaintext = 'hello world';
      const key = 'KEY';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      const result = vigenereCipher.crack(encrypted, { keyLength: 3 });

      expect(result).toHaveProperty('search');
      expect(result.search).toHaveProperty('optionCount');
      expect(result.search).toHaveProperty('candidateBudget');
    });

    it('should handle short text', () => {
      const plaintext = 'hello';
      const key = 'AB';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      const result = vigenereCipher.crack(encrypted);

      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('text');
    });

    it('should handle text with special characters', () => {
      const plaintext = 'Hello, World! 123';
      const key = 'KEY';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      const result = vigenereCipher.crack(encrypted, { keyLength: 3 });

      expect(result.text).toContain(',');
      expect(result.text).toContain('!');
      expect(result.text).toContain('123');
    });

    it('should crack with optimizations enabled', () => {
      const plaintext = 'the quick brown fox';
      const key = 'KEY';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      const result = vigenereCipher.crack(encrypted, {
        keyLength: 3,
        optimizations: true
      });

      expect(result.key).toBe(key);
      expect(result.text.toLowerCase()).toContain('quick');
    });

    it('should respect candidateBudget option', () => {
      const plaintext = 'hello world test';
      const key = 'AB';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      const result = vigenereCipher.crack(encrypted, {
        keyLength: 2,
        candidateBudget: 1000
      });

      expect(result.search.candidateBudget).toBe(1000);
    });

    it('should handle empty string', () => {
      const result = vigenereCipher.crack('');

      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('text');
    });

    it('should handle bruteforce fallback for very short text', () => {
      const plaintext = 'hello';
      const key = 'AB';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      const result = vigenereCipher.crack(encrypted, {
        keyLength: 2,
        bruteforceFallback: {
          enabled: true,
          maxKeyLength: 3
        }
      });

      expect(result).toHaveProperty('search');
    });

    it('should handle longer keys with hint', () => {
      const plaintext = 'the quick brown fox jumps over the lazy dog the end';
      const key = 'LONGER';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      const result = vigenereCipher.crack(encrypted, { keyLength: 6 });

      expect(result.key).toBe(key);
    });
  });

  describe('edge cases', () => {
    it('should handle very long text', () => {
      const longText = 'a'.repeat(1000);
      const key = 'KEY';
      const encrypted = vigenereCipher.encrypt(longText, key);
      expect(encrypted.length).toBe(1000);
      const decrypted = vigenereCipher.decrypt(encrypted, key);
      expect(decrypted).toBe(longText);
    });

    it('should handle unicode characters', () => {
      const text = 'Hello 世界 🌍';
      const key = 'KEY';
      const encrypted = vigenereCipher.encrypt(text, key);
      expect(encrypted).toContain('世界');
      expect(encrypted).toContain('🌍');
    });

    it('should handle all uppercase text', () => {
      const text = 'HELLO WORLD';
      const key = 'KEY';
      const encrypted = vigenereCipher.encrypt(text, key);
      const decrypted = vigenereCipher.decrypt(encrypted, key);
      expect(decrypted).toBe(text);
    });

    it('should handle all lowercase text', () => {
      const text = 'hello world';
      const key = 'KEY';
      const encrypted = vigenereCipher.encrypt(text, key);
      const decrypted = vigenereCipher.decrypt(encrypted, key);
      expect(decrypted).toBe(text);
    });

    it('should handle text with only non-alphabetic characters', () => {
      const text = '123 !@#';
      const key = 'KEY';
      const encrypted = vigenereCipher.encrypt(text, key);
      expect(encrypted).toBe(text);
    });

    it('should handle single letter key', () => {
      const text = 'HELLO';
      const key = 'Z';
      const encrypted = vigenereCipher.encrypt(text, key);
      expect(encrypted).toBe('GDKKN');
      const decrypted = vigenereCipher.decrypt(encrypted, key);
      expect(decrypted).toBe(text);
    });

    it('should handle key with repeated letters', () => {
      const text = 'HELLO WORLD';
      const key = 'AAA';
      const encrypted = vigenereCipher.encrypt(text, key);
      expect(encrypted).toBe('HELLO WORLD'); // AAA means no shift
    });
  });

  describe('round-trip encryption/decryption', () => {
    it('should handle round-trip with various keys', () => {
      const plaintext = 'The Quick Brown Fox Jumps Over The Lazy Dog';
      const keys = ['A', 'KEY', 'LEMON', 'SECRET', 'VERYLONGKEY'];

      for (const key of keys) {
        const encrypted = vigenereCipher.encrypt(plaintext, key);
        const decrypted = vigenereCipher.decrypt(encrypted, key);
        expect(decrypted).toBe(plaintext);
      }
    });

    it('should handle round-trip with special characters', () => {
      const plaintext = 'Hello, World! 123 @#$';
      const key = 'TEST';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      const decrypted = vigenereCipher.decrypt(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('crack with different text lengths', () => {
    it('should crack very short text', () => {
      const plaintext = 'hi';
      const key = 'AB';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      const result = vigenereCipher.crack(encrypted, { keyLength: 2 });

      expect(result).toHaveProperty('text');
    });

    it('should crack medium length text', () => {
      const plaintext = 'the quick brown fox jumps';
      const key = 'KEY';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      const result = vigenereCipher.crack(encrypted, { keyLength: 3 });

      expect(result.key).toBe(key);
    });

    it('should crack longer text', () => {
      const plaintext = 'the quick brown fox jumps over the lazy dog and then some more text to make it longer';
      const key = 'SECRET';
      const encrypted = vigenereCipher.encrypt(plaintext, key);
      const result = vigenereCipher.crack(encrypted, { keyLength: 6 });

      expect(result.key).toBe(key);
    });
  });
});