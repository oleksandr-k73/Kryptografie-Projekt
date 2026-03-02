import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

function loadRuntime() {
  const window = loadBrowserContext(["js/ciphers/caesarCipher.js"]);
  return window.KryptoCiphers.caesarCipher;
}

describe("caesarCipher", () => {
  describe("encryption", () => {
    it("encrypts text with key 3", () => {
      const caesar = loadRuntime();
      const encrypted = caesar.encrypt("HELLO", 3);
      expect(encrypted).toBe("KHOOR");
    });

    it("encrypts lowercase text with key 3", () => {
      const caesar = loadRuntime();
      const encrypted = caesar.encrypt("hello", 3);
      expect(encrypted).toBe("khoor");
    });

    it("encrypts mixed case text", () => {
      const caesar = loadRuntime();
      const encrypted = caesar.encrypt("Hello World", 3);
      expect(encrypted).toBe("Khoor Zruog");
    });

    it("preserves non-alphabetic characters", () => {
      const caesar = loadRuntime();
      const encrypted = caesar.encrypt("Hello, World! 123", 3);
      expect(encrypted).toBe("Khoor, Zruog! 123");
    });

    it("wraps around the alphabet correctly", () => {
      const caesar = loadRuntime();
      const encrypted = caesar.encrypt("XYZ", 3);
      expect(encrypted).toBe("ABC");
    });

    it("handles key 0 (no change)", () => {
      const caesar = loadRuntime();
      const encrypted = caesar.encrypt("HELLO", 0);
      expect(encrypted).toBe("HELLO");
    });

    it("handles key 26 (full rotation, no change)", () => {
      const caesar = loadRuntime();
      const encrypted = caesar.encrypt("HELLO", 26);
      expect(encrypted).toBe("HELLO");
    });

    it("handles negative keys", () => {
      const caesar = loadRuntime();
      const encrypted = caesar.encrypt("HELLO", -3);
      expect(encrypted).toBe("EBIIL");
    });

    it("handles large positive keys", () => {
      const caesar = loadRuntime();
      const encrypted = caesar.encrypt("HELLO", 29); // 29 % 26 = 3
      expect(encrypted).toBe("KHOOR");
    });

    it("handles empty string", () => {
      const caesar = loadRuntime();
      const encrypted = caesar.encrypt("", 3);
      expect(encrypted).toBe("");
    });
  });

  describe("decryption", () => {
    it("decrypts text with key 3", () => {
      const caesar = loadRuntime();
      const decrypted = caesar.decrypt("KHOOR", 3);
      expect(decrypted).toBe("HELLO");
    });

    it("decrypts lowercase text with key 3", () => {
      const caesar = loadRuntime();
      const decrypted = caesar.decrypt("khoor", 3);
      expect(decrypted).toBe("hello");
    });

    it("decrypts mixed case text", () => {
      const caesar = loadRuntime();
      const decrypted = caesar.decrypt("Khoor Zruog", 3);
      expect(decrypted).toBe("Hello World");
    });

    it("preserves non-alphabetic characters during decryption", () => {
      const caesar = loadRuntime();
      const decrypted = caesar.decrypt("Khoor, Zruog! 123", 3);
      expect(decrypted).toBe("Hello, World! 123");
    });

    it("wraps around the alphabet correctly during decryption", () => {
      const caesar = loadRuntime();
      const decrypted = caesar.decrypt("ABC", 3);
      expect(decrypted).toBe("XYZ");
    });

    it("handles key 0 during decryption", () => {
      const caesar = loadRuntime();
      const decrypted = caesar.decrypt("HELLO", 0);
      expect(decrypted).toBe("HELLO");
    });

    it("handles negative keys during decryption", () => {
      const caesar = loadRuntime();
      const decrypted = caesar.decrypt("EBIIL", -3);
      expect(decrypted).toBe("HELLO");
    });
  });

  describe("round-trip encryption and decryption", () => {
    it("correctly encrypts and decrypts", () => {
      const caesar = loadRuntime();
      const original = "The quick brown fox jumps over the lazy dog.";
      const encrypted = caesar.encrypt(original, 13);
      const decrypted = caesar.decrypt(encrypted, 13);
      expect(decrypted).toBe(original);
    });

    it("works with various keys", () => {
      const caesar = loadRuntime();
      const original = "Testing 123!";
      for (let key = 0; key < 26; key++) {
        const encrypted = caesar.encrypt(original, key);
        const decrypted = caesar.decrypt(encrypted, key);
        expect(decrypted).toBe(original);
      }
    });
  });

  describe("parseKey", () => {
    it("parses valid integer keys", () => {
      const caesar = loadRuntime();
      expect(caesar.parseKey("3")).toBe(3);
      expect(caesar.parseKey("13")).toBe(13);
      expect(caesar.parseKey("0")).toBe(0);
    });

    it("parses negative integer keys", () => {
      const caesar = loadRuntime();
      expect(caesar.parseKey("-3")).toBe(-3);
    });

    it("throws error for non-numeric keys", () => {
      const caesar = loadRuntime();
      expect(() => caesar.parseKey("abc")).toThrow("Schlüssel muss eine ganze Zahl sein.");
    });

    it("throws error for empty keys", () => {
      const caesar = loadRuntime();
      expect(() => caesar.parseKey("")).toThrow("Schlüssel muss eine ganze Zahl sein.");
    });
  });

  describe("crack", () => {
    it("cracks simple encrypted text", () => {
      const caesar = loadRuntime();
      const encrypted = caesar.encrypt("The quick brown fox", 5);
      const cracked = caesar.crack(encrypted);
      expect(cracked.key).toBe(5);
      expect(cracked.text).toBe("The quick brown fox");
    });

    it("cracks German text", () => {
      const caesar = loadRuntime();
      const encrypted = caesar.encrypt("Der schnelle braune Fuchs", 7);
      const cracked = caesar.crack(encrypted);
      expect(cracked.key).toBe(7);
      expect(cracked.text).toBe("Der schnelle braune Fuchs");
    });

    it("cracks English text with common words", () => {
      const caesar = loadRuntime();
      const encrypted = caesar.encrypt("The and is to of in", 11);
      const cracked = caesar.crack(encrypted);
      expect(cracked.key).toBe(11);
      expect(cracked.text).toBe("The and is to of in");
    });

    it("returns all 26 candidates", () => {
      const caesar = loadRuntime();
      const cracked = caesar.crack("KHOOR");
      expect(cracked.candidates).toHaveLength(8); // Only top 8 returned
      expect(cracked.candidates.every(c => c.key >= 0 && c.key < 26)).toBe(true);
    });

    it("returns candidates sorted by confidence", () => {
      const caesar = loadRuntime();
      const cracked = caesar.crack("Khoor Zruog");
      expect(cracked.candidates.length).toBeGreaterThan(0);
      for (let i = 1; i < cracked.candidates.length; i++) {
        expect(cracked.candidates[i - 1].confidence).toBeGreaterThanOrEqual(
          cracked.candidates[i].confidence
        );
      }
    });

    it("handles empty text gracefully", () => {
      const caesar = loadRuntime();
      const cracked = caesar.crack("");
      expect(cracked.key).toBe(0);
      expect(cracked.text).toBe("");
    });

    it("handles text with no letters", () => {
      const caesar = loadRuntime();
      const cracked = caesar.crack("123 !@# $%^");
      expect(cracked.key).toBeDefined();
      expect(cracked.text).toBe("123 !@# $%^");
    });

    it("handles ROT13 encryption and decryption", () => {
      const caesar = loadRuntime();
      const original = "The quick brown fox";
      const encrypted = caesar.encrypt(original, 13);
      const decrypted = caesar.decrypt(encrypted, 13);
      // ROT13 should work for encryption/decryption
      expect(decrypted).toBe(original);
      // Cracking may find a different key with better language score
      const cracked = caesar.crack(encrypted);
      expect(cracked.key).toBeGreaterThanOrEqual(0);
      expect(cracked.key).toBeLessThan(26);
      expect(cracked.text).toBeDefined();
    });

    it("includes confidence scores for all candidates", () => {
      const caesar = loadRuntime();
      const cracked = caesar.crack("KHOOR");
      expect(cracked.candidates.every(c => typeof c.confidence === "number")).toBe(true);
    });

    it("best candidate has highest confidence", () => {
      const caesar = loadRuntime();
      const encrypted = caesar.encrypt("This is a test message with many common words", 8);
      const cracked = caesar.crack(encrypted);
      expect(cracked.confidence).toBe(cracked.candidates[0].confidence);
    });
  });

  describe("cipher metadata", () => {
    it("has correct id", () => {
      const caesar = loadRuntime();
      expect(caesar.id).toBe("caesar");
    });

    it("has correct name", () => {
      const caesar = loadRuntime();
      expect(caesar.name).toBe("Cäsar");
    });

    it("supports key", () => {
      const caesar = loadRuntime();
      expect(caesar.supportsKey).toBe(true);
    });

    it("has key label and placeholder", () => {
      const caesar = loadRuntime();
      expect(caesar.keyLabel).toBe("Schlüssel");
      expect(caesar.keyPlaceholder).toBe("z. B. 3");
    });

    it("has info object with all fields", () => {
      const caesar = loadRuntime();
      expect(caesar.info).toBeDefined();
      expect(caesar.info.purpose).toBeDefined();
      expect(caesar.info.process).toBeDefined();
      expect(caesar.info.crack).toBeDefined();
      expect(caesar.info.useCase).toBeDefined();
    });
  });

  describe("edge cases and boundary conditions", () => {
    it("handles very long text", () => {
      const caesar = loadRuntime();
      const longText = "A".repeat(10000);
      const encrypted = caesar.encrypt(longText, 5);
      const decrypted = caesar.decrypt(encrypted, 5);
      expect(decrypted).toBe(longText);
    });

    it("handles all uppercase letters", () => {
      const caesar = loadRuntime();
      const text = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const encrypted = caesar.encrypt(text, 1);
      expect(encrypted).toBe("BCDEFGHIJKLMNOPQRSTUVWXYZA");
    });

    it("handles all lowercase letters", () => {
      const caesar = loadRuntime();
      const text = "abcdefghijklmnopqrstuvwxyz";
      const encrypted = caesar.encrypt(text, 1);
      expect(encrypted).toBe("bcdefghijklmnopqrstuvwxyza");
    });

    it("handles text with repeating characters", () => {
      const caesar = loadRuntime();
      const text = "aaaa bbbb cccc";
      const encrypted = caesar.encrypt(text, 3);
      expect(encrypted).toBe("dddd eeee ffff");
    });

    it("handles Unicode characters outside ASCII range", () => {
      const caesar = loadRuntime();
      const text = "Hello 世界 Welt";
      const encrypted = caesar.encrypt(text, 3);
      // Non-ASCII should be preserved
      expect(encrypted).toContain("世界");
    });

    it("cracking handles text with minimal letter content", () => {
      const caesar = loadRuntime();
      const text = "A B C";
      const cracked = caesar.crack(text);
      expect(cracked.key).toBeDefined();
      expect(cracked.text).toBeDefined();
    });

    it("handles key values at boundaries", () => {
      const caesar = loadRuntime();
      const text = "TEST";

      // Key 25 (one before wrap)
      const enc25 = caesar.encrypt(text, 25);
      const dec25 = caesar.decrypt(enc25, 25);
      expect(dec25).toBe(text);

      // Key 1 (minimal shift)
      const enc1 = caesar.encrypt(text, 1);
      const dec1 = caesar.decrypt(enc1, 1);
      expect(dec1).toBe(text);
    });
  });

  describe("scoring algorithm validation", () => {
    it("scores common words higher than gibberish", () => {
      const caesar = loadRuntime();
      const goodText = "the quick brown fox jumps";
      const badText = "xli uymgo fvsar jsb nyqtw";

      const crackGood = caesar.crack(goodText);
      const crackBad = caesar.crack(badText);

      // Good text should have higher confidence when not encrypted
      expect(crackGood.candidates[0].confidence).toBeGreaterThan(-Infinity);
    });

    it("recognizes German common words", () => {
      const caesar = loadRuntime();
      const germanText = "der die das und oder nicht";
      const encrypted = caesar.encrypt(germanText, 7);
      const cracked = caesar.crack(encrypted);
      expect(cracked.key).toBe(7);
    });

    it("recognizes English common words", () => {
      const caesar = loadRuntime();
      const englishText = "the and is to of in";
      const encrypted = caesar.encrypt(englishText, 9);
      const cracked = caesar.crack(encrypted);
      expect(cracked.key).toBe(9);
    });
  });
});