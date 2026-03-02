import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

function loadRuntime() {
  const window = loadBrowserContext(["js/ciphers/vigenereCipher.js"]);
  return window.KryptoCiphers.vigenereCipher;
}

describe("vigenereCipher", () => {
  describe("encryption", () => {
    it("encrypts text with key LEMON", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("ATTACKATDAWN", "LEMON");
      expect(encrypted).toBe("LXFOPVEFRNHR");
    });

    it("encrypts lowercase text", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("attackatdawn", "lemon");
      expect(encrypted).toBe("lxfopvefrnhr");
    });

    it("encrypts mixed case text", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("AttackAtDawn", "Lemon");
      expect(encrypted).toBe("LxfopvEfRnhr");
    });

    it("preserves non-alphabetic characters", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("ATTACK AT DAWN!", "LEMON");
      expect(encrypted).toBe("LXFOPV EF RNHR!");
    });

    it("handles empty text", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("", "LEMON");
      expect(encrypted).toBe("");
    });

    it("handles single character key", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("HELLO", "A");
      expect(encrypted).toBe("HELLO"); // A = shift 0
    });

    it("handles repeating key", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("AAAAAAA", "BC");
      expect(encrypted).toBe("BCBCBCB");
    });

    it("wraps around alphabet correctly", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("XYZ", "ZZZ");
      expect(encrypted).toBe("WXY");
    });
  });

  describe("decryption", () => {
    it("decrypts text with key LEMON", () => {
      const vigenere = loadRuntime();
      const decrypted = vigenere.decrypt("LXFOPVEFRNHR", "LEMON");
      expect(decrypted).toBe("ATTACKATDAWN");
    });

    it("decrypts lowercase text", () => {
      const vigenere = loadRuntime();
      const decrypted = vigenere.decrypt("lxfopvefrnhr", "lemon");
      expect(decrypted).toBe("attackatdawn");
    });

    it("decrypts mixed case text", () => {
      const vigenere = loadRuntime();
      const decrypted = vigenere.decrypt("LxfopvEfRnhr", "Lemon");
      expect(decrypted).toBe("AttackAtDawn");
    });

    it("preserves non-alphabetic characters during decryption", () => {
      const vigenere = loadRuntime();
      const decrypted = vigenere.decrypt("LXFOPV EF RNHR!", "LEMON");
      expect(decrypted).toBe("ATTACK AT DAWN!");
    });

    it("handles single character key", () => {
      const vigenere = loadRuntime();
      const decrypted = vigenere.decrypt("HELLO", "A");
      expect(decrypted).toBe("HELLO");
    });
  });

  describe("round-trip encryption and decryption", () => {
    it("correctly encrypts and decrypts", () => {
      const vigenere = loadRuntime();
      const original = "The quick brown fox jumps over the lazy dog";
      const encrypted = vigenere.encrypt(original, "SECRET");
      const decrypted = vigenere.decrypt(encrypted, "SECRET");
      expect(decrypted).toBe(original);
    });

    it("works with various keys", () => {
      const vigenere = loadRuntime();
      const original = "Testing Vigenere cipher";
      const keys = ["A", "KEY", "LONGERKEYWORD", "XYZ"];
      for (const key of keys) {
        const encrypted = vigenere.encrypt(original, key);
        const decrypted = vigenere.decrypt(encrypted, key);
        expect(decrypted).toBe(original);
      }
    });

    it("handles text longer than key", () => {
      const vigenere = loadRuntime();
      const original = "This is a much longer text that exceeds the key length";
      const encrypted = vigenere.encrypt(original, "KEY");
      const decrypted = vigenere.decrypt(encrypted, "KEY");
      expect(decrypted).toBe(original);
    });
  });

  describe("parseKey", () => {
    it("parses valid alphabetic keys", () => {
      const vigenere = loadRuntime();
      expect(vigenere.parseKey("LEMON")).toBe("LEMON");
      expect(vigenere.parseKey("KEY")).toBe("KEY");
    });

    it("converts lowercase to uppercase", () => {
      const vigenere = loadRuntime();
      expect(vigenere.parseKey("lemon")).toBe("LEMON");
      expect(vigenere.parseKey("KeY")).toBe("KEY");
    });

    it("handles German umlauts", () => {
      const vigenere = loadRuntime();
      expect(vigenere.parseKey("Äpfel")).toBe("AEPFEL");
      expect(vigenere.parseKey("Öl")).toBe("OEL");
      expect(vigenere.parseKey("Über")).toBe("UEBER");
      expect(vigenere.parseKey("Maß")).toBe("MASS");
    });

    it("removes non-alphabetic characters", () => {
      const vigenere = loadRuntime();
      expect(vigenere.parseKey("KEY-123")).toBe("KEY");
      expect(vigenere.parseKey("HELLO WORLD")).toBe("HELLOWORLD");
      expect(vigenere.parseKey("Test!@#$%Key")).toBe("TESTKEY");
    });

    it("throws error for empty or non-alphabetic keys", () => {
      const vigenere = loadRuntime();
      expect(() => vigenere.parseKey("")).toThrow(
        "Schlüssel muss mindestens einen Buchstaben enthalten."
      );
      expect(() => vigenere.parseKey("123")).toThrow(
        "Schlüssel muss mindestens einen Buchstaben enthalten."
      );
      expect(() => vigenere.parseKey("!@#")).toThrow(
        "Schlüssel muss mindestens einen Buchstaben enthalten."
      );
    });
  });

  describe("crack", () => {
    it("cracks simple encrypted text with key length hint", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("THEQUICKBROWNFOX", "KEY");
      const cracked = vigenere.crack(encrypted, { keyLength: 3 });
      expect(cracked.key).toBe("KEY");
      expect(cracked.text).toBe("THEQUICKBROWNFOX");
    });

    it("cracks text without key length hint", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("The quick brown fox jumps over the lazy dog", "SECRET");
      const cracked = vigenere.crack(encrypted);
      // Should find a reasonable decryption
      expect(cracked.key).toBeDefined();
      expect(cracked.text).toBeDefined();
      expect(cracked.confidence).toBeGreaterThan(-Infinity);
    });

    it("returns multiple candidates", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("Hello World", "ABC");
      const cracked = vigenere.crack(encrypted, { keyLength: 3 });
      expect(cracked.candidates).toBeDefined();
      expect(Array.isArray(cracked.candidates)).toBe(true);
      expect(cracked.candidates.length).toBeGreaterThan(0);
    });

    it("candidates are sorted by confidence", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("The quick brown fox", "KEY");
      const cracked = vigenere.crack(encrypted, { keyLength: 3 });
      for (let i = 1; i < cracked.candidates.length; i++) {
        expect(cracked.candidates[i - 1].confidence).toBeGreaterThanOrEqual(
          cracked.candidates[i].confidence
        );
      }
    });

    it("includes search metadata", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("Test message", "KEY");
      const cracked = vigenere.crack(encrypted, { keyLength: 3 });
      expect(cracked.search).toBeDefined();
      expect(typeof cracked.search).toBe("object");
    });

    it("handles empty text", () => {
      const vigenere = loadRuntime();
      const cracked = vigenere.crack("");
      expect(cracked.key).toBe("A");
      expect(cracked.text).toBe("");
    });

    it("handles text with no letters", () => {
      const vigenere = loadRuntime();
      const cracked = vigenere.crack("123 !@# $%^");
      expect(cracked.key).toBeDefined();
      expect(cracked.text).toBe("123 !@# $%^");
    });

    it("respects keyLength option", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("ATTACKATDAWN", "LEMON");
      const cracked = vigenere.crack(encrypted, { keyLength: 5 });
      expect(cracked.key).toBe("LEMON");
    });

    it("works with optimization flag disabled", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("Testing cipher", "KEY");
      const cracked = vigenere.crack(encrypted, {
        keyLength: 3,
        optimizations: false,
      });
      expect(cracked.key).toBe("KEY");
    });

    it("works with optimization flag enabled", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("Testing cipher", "KEY");
      const cracked = vigenere.crack(encrypted, {
        keyLength: 3,
        optimizations: true,
      });
      expect(cracked.key).toBe("KEY");
    });
  });

  describe("cipher metadata", () => {
    it("has correct id", () => {
      const vigenere = loadRuntime();
      expect(vigenere.id).toBe("vigenere");
    });

    it("has correct name", () => {
      const vigenere = loadRuntime();
      expect(vigenere.name).toBe("Vigenère");
    });

    it("supports key", () => {
      const vigenere = loadRuntime();
      expect(vigenere.supportsKey).toBe(true);
    });

    it("supports crack length hint", () => {
      const vigenere = loadRuntime();
      expect(vigenere.supportsCrackLengthHint).toBe(true);
    });

    it("has key label and placeholder", () => {
      const vigenere = loadRuntime();
      expect(vigenere.keyLabel).toBe("Schlüsselwort");
      expect(vigenere.keyPlaceholder).toBe("z. B. LEMON");
    });

    it("has crack length label and placeholder", () => {
      const vigenere = loadRuntime();
      expect(vigenere.crackLengthLabel).toBe("Schlüssellänge");
      expect(vigenere.crackLengthPlaceholder).toBe("z. B. 6");
    });

    it("has info object with all fields", () => {
      const vigenere = loadRuntime();
      expect(vigenere.info).toBeDefined();
      expect(vigenere.info.purpose).toBeDefined();
      expect(vigenere.info.process).toBeDefined();
      expect(vigenere.info.crack).toBeDefined();
      expect(vigenere.info.useCase).toBeDefined();
    });
  });

  describe("edge cases and boundary conditions", () => {
    it("handles very long text", () => {
      const vigenere = loadRuntime();
      const longText = "A".repeat(1000);
      const encrypted = vigenere.encrypt(longText, "KEY");
      const decrypted = vigenere.decrypt(encrypted, "KEY");
      expect(decrypted).toBe(longText);
    });

    it("handles very long key", () => {
      const vigenere = loadRuntime();
      const text = "SHORT";
      const longKey = "VERYLONGKEYTHATEXCEEDSTEXTLENGTH";
      const encrypted = vigenere.encrypt(text, longKey);
      const decrypted = vigenere.decrypt(encrypted, longKey);
      expect(decrypted).toBe(text);
    });

    it("handles all uppercase letters", () => {
      const vigenere = loadRuntime();
      const text = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const encrypted = vigenere.encrypt(text, "KEY");
      const decrypted = vigenere.decrypt(encrypted, "KEY");
      expect(decrypted).toBe(text);
    });

    it("handles all lowercase letters", () => {
      const vigenere = loadRuntime();
      const text = "abcdefghijklmnopqrstuvwxyz";
      const encrypted = vigenere.encrypt(text, "key");
      const decrypted = vigenere.decrypt(encrypted, "key");
      expect(decrypted).toBe(text);
    });

    it("handles text with only spaces and punctuation between words", () => {
      const vigenere = loadRuntime();
      const text = "Hello, World! How are you?";
      const encrypted = vigenere.encrypt(text, "KEY");
      const decrypted = vigenere.decrypt(encrypted, "KEY");
      expect(decrypted).toBe(text);
    });

    it("handles Unicode characters", () => {
      const vigenere = loadRuntime();
      const text = "Hello 世界 Welt";
      const encrypted = vigenere.encrypt(text, "KEY");
      expect(encrypted).toContain("世界"); // Non-ASCII preserved
      const decrypted = vigenere.decrypt(encrypted, "KEY");
      expect(decrypted).toBe(text);
    });

    it("handles single letter text", () => {
      const vigenere = loadRuntime();
      const text = "A";
      const encrypted = vigenere.encrypt(text, "KEY");
      expect(encrypted).toBe("K");
      const decrypted = vigenere.decrypt(encrypted, "KEY");
      expect(decrypted).toBe(text);
    });

    it("key with all same letter behaves like Caesar", () => {
      const vigenere = loadRuntime();
      const text = "HELLO";
      const encrypted = vigenere.encrypt(text, "CCC");
      // Should be same as Caesar with shift 2 (C = 2)
      expect(encrypted).toBe("JGNNQ");
    });
  });

  describe("options validation", () => {
    it("handles invalid keyLength gracefully", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("Test", "KEY");

      // Should not throw, should handle gracefully
      const result1 = vigenere.crack(encrypted, { keyLength: 0 });
      expect(result1.key).toBeDefined();

      const result2 = vigenere.crack(encrypted, { keyLength: -5 });
      expect(result2.key).toBeDefined();
    });

    it("handles null options", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("Test message", "KEY");
      const cracked = vigenere.crack(encrypted, null);
      expect(cracked.key).toBeDefined();
      expect(cracked.text).toBeDefined();
    });

    it("handles undefined options", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("Test message", "KEY");
      const cracked = vigenere.crack(encrypted);
      expect(cracked.key).toBeDefined();
      expect(cracked.text).toBeDefined();
    });

    it("handles custom bruteforce fallback options", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("Short", "AB");
      const cracked = vigenere.crack(encrypted, {
        keyLength: 2,
        bruteforceFallback: {
          enabled: true,
          maxKeyLength: 3,
        },
      });
      expect(cracked.key).toBeDefined();
    });

    it("handles disabled bruteforce fallback", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("Short", "AB");
      const cracked = vigenere.crack(encrypted, {
        keyLength: 2,
        bruteforceFallback: {
          enabled: false,
        },
      });
      expect(cracked.key).toBeDefined();
    });
  });

  describe("optimization modes comparison", () => {
    it("both modes produce valid results", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("The quick brown fox", "SECRET");

      const withOptimizations = vigenere.crack(encrypted, {
        keyLength: 6,
        optimizations: true,
      });

      const withoutOptimizations = vigenere.crack(encrypted, {
        keyLength: 6,
        optimizations: false,
      });

      expect(withOptimizations.key).toBeDefined();
      expect(withoutOptimizations.key).toBeDefined();
      expect(withOptimizations.text).toBeDefined();
      expect(withoutOptimizations.text).toBeDefined();
    });

    it("optimization mode includes stats when requested", () => {
      const vigenere = loadRuntime();
      const encrypted = vigenere.encrypt("Test", "KEY");
      const cracked = vigenere.crack(encrypted, {
        keyLength: 3,
        optimizations: true,
        collectStats: true,
      });

      expect(cracked.search).toBeDefined();
      if (cracked.search.telemetry) {
        expect(cracked.search.telemetry).toBeDefined();
        expect(typeof cracked.search.telemetry).toBe("object");
      }
    });
  });

  describe("special plaintext cases", () => {
    it("cracks text with German umlauts in plaintext", () => {
      const vigenere = loadRuntime();
      // Umlauts get normalized during encryption
      const encrypted = vigenere.encrypt("Äpfel Über Straße", "KEY");
      const decrypted = vigenere.decrypt(encrypted, "KEY");
      // Non-ASCII chars are preserved but umlauts in letters get transformed
      expect(decrypted).toBeDefined();
    });

    it("handles repeating plaintext patterns", () => {
      const vigenere = loadRuntime();
      const text = "ABABABABAB";
      const encrypted = vigenere.encrypt(text, "CD");
      const decrypted = vigenere.decrypt(encrypted, "CD");
      expect(decrypted).toBe(text);
    });

    it("handles text where key repeats exactly with text length", () => {
      const vigenere = loadRuntime();
      const text = "ABCDEFGHI"; // 9 letters
      const key = "ABC"; // repeats 3 times
      const encrypted = vigenere.encrypt(text, key);
      const decrypted = vigenere.decrypt(encrypted, key);
      expect(decrypted).toBe(text);
    });
  });
});