import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load the file parsers module
const parsersCode = readFileSync(join(process.cwd(), 'js/core/fileParsers.js'), 'utf8');
const global = { KryptoCore: {} };
new Function('window', parsersCode)(global);
const parseInputFile = global.KryptoCore.parseInputFile;

// Helper to create mock File object
function createMockFile(name, content) {
  return {
    name,
    text: async () => content
  };
}

describe('parseInputFile', () => {
  describe('TXT files', () => {
    it('should parse plain text file', async () => {
      const file = createMockFile('test.txt', 'Hello World');
      const result = await parseInputFile(file);

      expect(result.text).toBe('Hello World');
      expect(result.format).toBe('txt');
      expect(result.fallback).toBe(false);
    });

    it('should handle empty txt file', async () => {
      const file = createMockFile('test.txt', '');
      const result = await parseInputFile(file);

      expect(result.text).toBe('');
      expect(result.format).toBe('txt');
    });

    it('should handle multiline text', async () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const file = createMockFile('test.txt', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe(content);
    });

    it('should handle text with special characters', async () => {
      const content = 'Hello! @#$ %^& *()';
      const file = createMockFile('test.txt', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe(content);
    });

    it('should handle unicode text', async () => {
      const content = 'Hello 世界 🌍 äöü';
      const file = createMockFile('test.txt', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe(content);
    });
  });

  describe('LOG files', () => {
    it('should parse log file as plain text', async () => {
      const content = '2024-01-01 INFO: Test log message';
      const file = createMockFile('test.log', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe(content);
      expect(result.format).toBe('log');
      expect(result.fallback).toBe(false);
    });
  });

  describe('MD files', () => {
    it('should parse markdown file as plain text', async () => {
      const content = '# Heading\n\nParagraph with **bold**';
      const file = createMockFile('test.md', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe(content);
      expect(result.format).toBe('md');
      expect(result.fallback).toBe(false);
    });
  });

  describe('JSON files', () => {
    it('should extract text from JSON with text field', async () => {
      const content = JSON.stringify({ text: 'Hello World' });
      const file = createMockFile('test.json', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Hello World');
      expect(result.format).toBe('json');
      expect(result.fallback).toBe(false);
    });

    it('should extract from ciphertext field', async () => {
      const content = JSON.stringify({ ciphertext: 'Encrypted Text' });
      const file = createMockFile('test.json', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Encrypted Text');
    });

    it('should extract from message field', async () => {
      const content = JSON.stringify({ message: 'Test Message' });
      const file = createMockFile('test.json', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Test Message');
    });

    it('should prefer coded/cipher fields over generic text', async () => {
      const content = JSON.stringify({
        text: 'Generic text',
        ciphertext: 'Cipher text'
      });
      const file = createMockFile('test.json', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Cipher text');
    });

    it('should extract from nested objects', async () => {
      const content = JSON.stringify({
        level1: {
          level2: {
            text: 'Nested Text'
          }
        }
      });
      const file = createMockFile('test.json', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Nested Text');
    });

    it('should extract from arrays', async () => {
      const content = JSON.stringify({
        messages: [
          { text: 'First' },
          { text: 'Second' }
        ]
      });
      const file = createMockFile('test.json', content);
      const result = await parseInputFile(file);

      expect(result.text).toBeDefined();
    });

    it('should throw error when no text field found', async () => {
      const content = JSON.stringify({ number: 123, flag: true });
      const file = createMockFile('test.json', content);

      await expect(parseInputFile(file)).rejects.toThrow('In der JSON-Datei wurde kein Textfeld gefunden');
    });

    it('should handle empty JSON object', async () => {
      const content = JSON.stringify({});
      const file = createMockFile('test.json', content);

      await expect(parseInputFile(file)).rejects.toThrow();
    });

    it('should reject hash-like strings', async () => {
      const content = JSON.stringify({
        text: 'abc123',
        hash: 'a'.repeat(64) // Long hex string
      });
      const file = createMockFile('test.json', content);
      const result = await parseInputFile(file);

      // Should prefer 'text' over 'hash'
      expect(result.text).toBe('abc123');
    });

    it('should handle JSON with special characters', async () => {
      const content = JSON.stringify({ text: 'Hello! @#$ %^&' });
      const file = createMockFile('test.json', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Hello! @#$ %^&');
    });
  });

  describe('CSV files', () => {
    it('should parse CSV with header', async () => {
      const content = 'text,value\nHello,123\nWorld,456';
      const file = createMockFile('test.csv', content);
      const result = await parseInputFile(file);

      expect(result.text).toContain('Hello');
      expect(result.text).toContain('World');
      expect(result.format).toBe('csv');
      expect(result.fallback).toBe(false);
    });

    it('should extract from coded column', async () => {
      const content = 'coded,other\nCiphertext1,data\nCiphertext2,more';
      const file = createMockFile('test.csv', content);
      const result = await parseInputFile(file);

      expect(result.text).toContain('Ciphertext1');
      expect(result.text).toContain('Ciphertext2');
      expect(result.text).not.toContain('data');
    });

    it('should handle CSV with single row', async () => {
      const content = 'Hello,World,Test';
      const file = createMockFile('test.csv', content);
      const result = await parseInputFile(file);

      expect(result.text).toContain('Hello');
      expect(result.text).toContain('World');
    });

    it('should handle CSV with quoted fields', async () => {
      const content = 'text\n"Hello, World"\n"Test, Data"';
      const file = createMockFile('test.csv', content);
      const result = await parseInputFile(file);

      expect(result.text).toContain('Hello, World');
      expect(result.text).toContain('Test, Data');
    });

    it('should handle CSV with escaped quotes', async () => {
      const content = 'text\n"He said ""Hello"""';
      const file = createMockFile('test.csv', content);
      const result = await parseInputFile(file);

      expect(result.text).toContain('He said "Hello"');
    });

    it('should handle semicolon-separated values', async () => {
      const content = 'text;value\nHello;123';
      const file = createMockFile('test.csv', content);
      const result = await parseInputFile(file);

      expect(result.text).toContain('Hello');
    });

    it('should handle tab-separated values', async () => {
      const content = 'text\tvalue\nHello\t123';
      const file = createMockFile('test.csv', content);
      const result = await parseInputFile(file);

      expect(result.text).toContain('Hello');
    });

    it('should handle empty CSV', async () => {
      const file = createMockFile('test.csv', '');
      const result = await parseInputFile(file);

      expect(result.text).toBe('');
    });

    it('should handle CSV without recognized text column', async () => {
      const content = 'id,count\n1,100\n2,200';
      const file = createMockFile('test.csv', content);
      const result = await parseInputFile(file);

      expect(result.text).toBeDefined();
    });
  });

  describe('JavaScript files', () => {
    it('should extract from const assignment', async () => {
      const content = 'const message = "Hello World";';
      const file = createMockFile('test.js', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Hello World');
      expect(result.format).toBe('js');
      expect(result.fallback).toBe(false);
    });

    it('should extract from let assignment', async () => {
      const content = 'let text = "Test Text";';
      const file = createMockFile('test.js', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Test Text');
    });

    it('should extract from var assignment', async () => {
      const content = 'var data = "Data Value";';
      const file = createMockFile('test.js', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Data Value');
    });

    it('should extract from object property', async () => {
      const content = 'const obj = { text: "Hello World" };';
      const file = createMockFile('test.js', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Hello World');
    });

    it('should handle single quotes', async () => {
      const content = "const message = 'Hello World';";
      const file = createMockFile('test.js', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Hello World');
    });

    it('should handle template literals', async () => {
      const content = 'const message = `Hello World`;';
      const file = createMockFile('test.js', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Hello World');
    });

    it('should handle escaped characters', async () => {
      const content = 'const text = "Hello\\nWorld";';
      const file = createMockFile('test.js', content);
      const result = await parseInputFile(file);

      expect(result.text).toContain('\n');
    });

    it('should prefer cipher-related variable names', async () => {
      const content = `
        const title = "Title";
        const ciphertext = "Encrypted";
        const random = "Random";
      `;
      const file = createMockFile('test.js', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Encrypted');
    });

    it('should handle .mjs files', async () => {
      const content = 'export const message = "Hello";';
      const file = createMockFile('test.mjs', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Hello');
      expect(result.format).toBe('mjs');
    });

    it('should handle .cjs files', async () => {
      const content = 'const message = "Hello";';
      const file = createMockFile('test.cjs', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Hello');
      expect(result.format).toBe('cjs');
    });

    it('should fallback to raw content if no strings found', async () => {
      const content = 'const x = 123;';
      const file = createMockFile('test.js', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe(content);
    });
  });

  describe('unknown file types', () => {
    it('should return raw content with fallback flag', async () => {
      const content = 'Unknown file content';
      const file = createMockFile('test.xyz', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe(content);
      expect(result.format).toBe('xyz');
      expect(result.fallback).toBe(true);
    });

    it('should handle file without extension', async () => {
      const content = 'Content';
      const file = createMockFile('testfile', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe(content);
      expect(result.fallback).toBe(true);
    });

    it('should be case insensitive for extensions', async () => {
      const content = 'Hello';
      const file = createMockFile('test.TXT', content);
      const result = await parseInputFile(file);

      expect(result.format).toBe('txt');
      expect(result.fallback).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle very long text', async () => {
      const content = 'a'.repeat(100000);
      const file = createMockFile('test.txt', content);
      const result = await parseInputFile(file);

      expect(result.text.length).toBe(100000);
    });

    it('should handle binary-looking content', async () => {
      const content = '\x00\x01\x02\x03';
      const file = createMockFile('test.txt', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe(content);
    });

    it('should handle malformed JSON', async () => {
      const content = '{ invalid json }';
      const file = createMockFile('test.json', content);

      await expect(parseInputFile(file)).rejects.toThrow();
    });

    it('should handle deeply nested JSON', async () => {
      const nested = { a: { b: { c: { d: { e: { text: 'Deep' } } } } } };
      const content = JSON.stringify(nested);
      const file = createMockFile('test.json', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Deep');
    });

    it('should handle JSON with array of strings', async () => {
      const content = JSON.stringify({
        messages: ['First', 'Second', 'Third']
      });
      const file = createMockFile('test.json', content);
      const result = await parseInputFile(file);

      expect(result.text).toBeDefined();
    });

    it('should handle CSV with Windows line endings', async () => {
      const content = 'text\r\nHello\r\nWorld';
      const file = createMockFile('test.csv', content);
      const result = await parseInputFile(file);

      expect(result.text).toContain('Hello');
      expect(result.text).toContain('World');
    });

    it('should handle CSV with empty cells', async () => {
      const content = 'text,value\n,\nHello,';
      const file = createMockFile('test.csv', content);
      const result = await parseInputFile(file);

      expect(result.text).toContain('Hello');
    });

    it('should handle JavaScript with unicode escapes', async () => {
      const content = 'const text = "\\u0048\\u0065\\u006c\\u006c\\u006f";';
      const file = createMockFile('test.js', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Hello');
    });

    it('should handle JavaScript with hex escapes', async () => {
      const content = 'const text = "\\x48\\x65\\x6c\\x6c\\x6f";';
      const file = createMockFile('test.js', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Hello');
    });

    it('should handle multiline strings in JavaScript', async () => {
      const content = 'const text = `Line 1\nLine 2\nLine 3`;';
      const file = createMockFile('test.js', content);
      const result = await parseInputFile(file);

      expect(result.text).toContain('\n');
    });
  });

  describe('scoring and prioritization', () => {
    it('should prefer text with spaces', async () => {
      const content = JSON.stringify({
        id: 'singleword',
        text: 'Multiple word text'
      });
      const file = createMockFile('test.json', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Multiple word text');
    });

    it('should prefer text with letters', async () => {
      const content = JSON.stringify({
        numbers: '123456',
        text: 'Hello123'
      });
      const file = createMockFile('test.json', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Hello123');
    });

    it('should avoid very short strings', async () => {
      const content = JSON.stringify({
        x: 'ab',
        message: 'Longer message here'
      });
      const file = createMockFile('test.json', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Longer message here');
    });

    it('should avoid metadata fields', async () => {
      const content = JSON.stringify({
        title: 'Document Title',
        id: '12345',
        content: 'Actual content text'
      });
      const file = createMockFile('test.json', content);
      const result = await parseInputFile(file);

      expect(result.text).toBe('Actual content text');
    });
  });
});