import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("caesarCipher", () => {
  let caesarCipher;

  beforeAll(() => {
    const global = {};
    const code = readFileSync(
      join(process.cwd(), "js/ciphers/caesarCipher.js"),
      "utf-8"
    );
    const fn = new Function("window", code);
    fn(global);
    caesarCipher = global.KryptoCiphers.caesarCipher;
  });

  describe("parseKey", () => {
    it("should parse valid integer keys", () => {
      expect(caesarCipher.parseKey("3")).toBe(3);
      expect(caesarCipher.parseKey("13")).toBe(13);
      expect(caesarCipher.parseKey("0")).toBe(0);
    });

    it("should parse negative integer keys", () => {
      expect(caesarCipher.parseKey("-5")).toBe(-5);
    });

    it("should throw error for non-integer keys", () => {
      expect(() => caesarCipher.parseKey("abc")).toThrow(
        "Schlüssel muss eine ganze Zahl sein."
      );
      // Note: parseInt("3.5") returns 3, which is valid behavior
    });
  });

  describe("encrypt", () => {
    it("should encrypt text with positive key", () => {
      expect(caesarCipher.encrypt("ABC", 3)).toBe("DEF");
      expect(caesarCipher.encrypt("xyz", 3)).toBe("abc");
    });

    it("should handle wrapping around the alphabet", () => {
      expect(caesarCipher.encrypt("XYZ", 3)).toBe("ABC");
      expect(caesarCipher.encrypt("xyz", 3)).toBe("abc");
    });

    it("should preserve case", () => {
      expect(caesarCipher.encrypt("Hello World", 5)).toBe("Mjqqt Btwqi");
    });

    it("should not encrypt non-letter characters", () => {
      expect(caesarCipher.encrypt("Hello, World! 123", 3)).toBe(
        "Khoor, Zruog! 123"
      );
    });

    it("should handle negative keys by wrapping", () => {
      expect(caesarCipher.encrypt("ABC", -3)).toBe("XYZ");
    });

    it("should handle keys larger than 26", () => {
      expect(caesarCipher.encrypt("ABC", 29)).toBe("DEF"); // 29 % 26 = 3
    });

    it("should handle empty string", () => {
      expect(caesarCipher.encrypt("", 3)).toBe("");
    });
  });

  describe("decrypt", () => {
    it("should decrypt text with correct key", () => {
      expect(caesarCipher.decrypt("DEF", 3)).toBe("ABC");
      expect(caesarCipher.decrypt("Khoor", 3)).toBe("Hello");
    });

    it("should be inverse of encrypt", () => {
      const original = "The Quick Brown Fox";
      const key = 7;
      const encrypted = caesarCipher.encrypt(original, key);
      const decrypted = caesarCipher.decrypt(encrypted, key);
      expect(decrypted).toBe(original);
    });

    it("should handle wrapping", () => {
      expect(caesarCipher.decrypt("ABC", 3)).toBe("XYZ");
    });

    it("should preserve non-letter characters", () => {
      expect(caesarCipher.decrypt("Khoor, Zruog! 123", 3)).toBe(
        "Hello, World! 123"
      );
    });
  });

  describe("crack", () => {
    it("should crack simple encrypted text", () => {
      const encrypted = caesarCipher.encrypt("der und die ist nicht", 5);
      const result = caesarCipher.crack(encrypted);

      expect(result.key).toBe(5);
      expect(result.text).toBe("der und die ist nicht");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should return candidates array", () => {
      const encrypted = caesarCipher.encrypt("hello world", 3);
      const result = caesarCipher.crack(encrypted);

      expect(Array.isArray(result.candidates)).toBe(true);
      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.candidates.length).toBeLessThanOrEqual(8);
    });

    it("should rank candidates by confidence", () => {
      const encrypted = caesarCipher.encrypt("das ist ein test", 7);
      const result = caesarCipher.crack(encrypted);

      // Check that candidates are sorted by confidence (descending)
      for (let i = 0; i < result.candidates.length - 1; i++) {
        expect(result.candidates[i].confidence).toBeGreaterThanOrEqual(
          result.candidates[i + 1].confidence
        );
      }
    });

    it("should crack English text", () => {
      const encrypted = caesarCipher.encrypt("the quick brown fox", 13);
      const result = caesarCipher.crack(encrypted);

      expect(result.key).toBe(13);
      expect(result.text.toLowerCase()).toBe("the quick brown fox");
    });

    it("should handle text with mixed case and punctuation", () => {
      const original = "Hello, World! This is a test.";
      const encrypted = caesarCipher.encrypt(original, 10);
      const result = caesarCipher.crack(encrypted);

      expect(result.key).toBe(10);
      expect(result.text).toBe(original);
    });

    it("should include key, text, and confidence in result", () => {
      const result = caesarCipher.crack("Khoor");

      expect(result).toHaveProperty("key");
      expect(result).toHaveProperty("text");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("candidates");
    });

    it("should handle empty string", () => {
      const result = caesarCipher.crack("");

      expect(result.key).toBeDefined();
      expect(result.text).toBe("");
    });

    it("should crack quantum-themed text", () => {
      const encrypted = caesarCipher.encrypt("klassisch quanten", 8);
      const result = caesarCipher.crack(encrypted);

      expect(result.key).toBe(8);
      expect(result.text).toBe("klassisch quanten");
    });
  });

  describe("cipher metadata", () => {
    it("should have correct id and name", () => {
      expect(caesarCipher.id).toBe("caesar");
      expect(caesarCipher.name).toBe("Cäsar");
    });

    it("should support key", () => {
      expect(caesarCipher.supportsKey).toBe(true);
    });

    it("should have info object with all required fields", () => {
      expect(caesarCipher.info).toBeDefined();
      expect(caesarCipher.info.purpose).toBeDefined();
      expect(caesarCipher.info.process).toBeDefined();
      expect(caesarCipher.info.crack).toBeDefined();
      expect(caesarCipher.info.useCase).toBeDefined();
    });

    it("should have keyLabel and keyPlaceholder", () => {
      expect(caesarCipher.keyLabel).toBe("Schlüssel");
      expect(caesarCipher.keyPlaceholder).toBe("z. B. 3");
    });
  });

  describe("edge cases", () => {
    it("should handle very long text", () => {
      const longText = "der die und ".repeat(100);
      const encrypted = caesarCipher.encrypt(longText, 5);
      const decrypted = caesarCipher.decrypt(encrypted, 5);
      expect(decrypted).toBe(longText);
    });

    it("should handle text with only non-letters", () => {
      const text = "123 !@# $%^";
      expect(caesarCipher.encrypt(text, 5)).toBe(text);
      expect(caesarCipher.decrypt(text, 5)).toBe(text);
    });

    it("should handle single character", () => {
      expect(caesarCipher.encrypt("A", 1)).toBe("B");
      expect(caesarCipher.decrypt("B", 1)).toBe("A");
    });

    it("should handle key of 0", () => {
      const text = "Hello World";
      expect(caesarCipher.encrypt(text, 0)).toBe(text);
      expect(caesarCipher.decrypt(text, 0)).toBe(text);
    });

    it("should handle key of 26 (full rotation)", () => {
      const text = "Hello World";
      expect(caesarCipher.encrypt(text, 26)).toBe(text);
    });
  });
});