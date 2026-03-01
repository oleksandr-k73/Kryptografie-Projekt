import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("CipherRegistry", () => {
  let CipherRegistry;

  beforeAll(() => {
    const global = {};
    const code = readFileSync(
      join(process.cwd(), "js/core/cipherRegistry.js"),
      "utf-8"
    );
    const fn = new Function("window", code);
    fn(global);
    CipherRegistry = global.KryptoCore.CipherRegistry;
  });

  describe("constructor", () => {
    it("should create a new registry instance", () => {
      const registry = new CipherRegistry();
      expect(registry).toBeDefined();
      expect(registry.ciphers).toBeInstanceOf(Map);
    });

    it("should start with empty registry", () => {
      const registry = new CipherRegistry();
      expect(registry.list()).toEqual([]);
    });
  });

  describe("register", () => {
    let registry;

    beforeEach(() => {
      registry = new CipherRegistry();
    });

    it("should register a valid cipher", () => {
      const cipher = {
        id: "test",
        name: "Test Cipher",
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {},
      };

      expect(() => registry.register(cipher)).not.toThrow();
      expect(registry.get("test")).toBe(cipher);
    });

    it("should register multiple ciphers", () => {
      const cipher1 = {
        id: "test1",
        name: "Test 1",
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {},
      };
      const cipher2 = {
        id: "test2",
        name: "Test 2",
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {},
      };

      registry.register(cipher1);
      registry.register(cipher2);

      expect(registry.list()).toHaveLength(2);
      expect(registry.get("test1")).toBe(cipher1);
      expect(registry.get("test2")).toBe(cipher2);
    });

    it("should throw error if id is missing", () => {
      const cipher = {
        name: "Test",
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {},
      };

      expect(() => registry.register(cipher)).toThrow("Cipher fehlt Feld: id");
    });

    it("should throw error if name is missing", () => {
      const cipher = {
        id: "test",
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {},
      };

      expect(() => registry.register(cipher)).toThrow(
        "Cipher fehlt Feld: name"
      );
    });

    it("should throw error if encrypt is missing", () => {
      const cipher = {
        id: "test",
        name: "Test",
        decrypt: () => {},
        crack: () => {},
      };

      expect(() => registry.register(cipher)).toThrow(
        "Cipher fehlt Feld: encrypt"
      );
    });

    it("should throw error if decrypt is missing", () => {
      const cipher = {
        id: "test",
        name: "Test",
        encrypt: () => {},
        crack: () => {},
      };

      expect(() => registry.register(cipher)).toThrow(
        "Cipher fehlt Feld: decrypt"
      );
    });

    it("should throw error if crack is missing", () => {
      const cipher = {
        id: "test",
        name: "Test",
        encrypt: () => {},
        decrypt: () => {},
      };

      expect(() => registry.register(cipher)).toThrow(
        "Cipher fehlt Feld: crack"
      );
    });

    it("should throw error if encrypt is not a function", () => {
      const cipher = {
        id: "test",
        name: "Test",
        encrypt: "not a function",
        decrypt: () => {},
        crack: () => {},
      };

      expect(() => registry.register(cipher)).toThrow(
        "Cipher-Feld encrypt muss eine Funktion sein."
      );
    });

    it("should throw error if decrypt is not a function", () => {
      const cipher = {
        id: "test",
        name: "Test",
        encrypt: () => {},
        decrypt: 123,
        crack: () => {},
      };

      expect(() => registry.register(cipher)).toThrow(
        "Cipher-Feld decrypt muss eine Funktion sein."
      );
    });

    it("should throw error if crack is not a function", () => {
      const cipher = {
        id: "test",
        name: "Test",
        encrypt: () => {},
        decrypt: () => {},
        crack: null,
      };

      expect(() => registry.register(cipher)).toThrow(
        "Cipher-Feld crack muss eine Funktion sein."
      );
    });

    it("should allow cipher with additional optional fields", () => {
      const cipher = {
        id: "test",
        name: "Test",
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {},
        supportsKey: true,
        keyLabel: "Key",
        info: {
          purpose: "Test purpose",
        },
      };

      expect(() => registry.register(cipher)).not.toThrow();
      expect(registry.get("test").supportsKey).toBe(true);
    });

    it("should overwrite cipher with same id", () => {
      const cipher1 = {
        id: "test",
        name: "Test 1",
        encrypt: () => "v1",
        decrypt: () => {},
        crack: () => {},
      };
      const cipher2 = {
        id: "test",
        name: "Test 2",
        encrypt: () => "v2",
        decrypt: () => {},
        crack: () => {},
      };

      registry.register(cipher1);
      registry.register(cipher2);

      expect(registry.get("test")).toBe(cipher2);
      expect(registry.list()).toHaveLength(1);
    });
  });

  describe("get", () => {
    let registry;

    beforeEach(() => {
      registry = new CipherRegistry();
    });

    it("should return registered cipher by id", () => {
      const cipher = {
        id: "test",
        name: "Test",
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {},
      };

      registry.register(cipher);
      expect(registry.get("test")).toBe(cipher);
    });

    it("should return undefined for non-existent id", () => {
      expect(registry.get("nonexistent")).toBeUndefined();
    });

    it("should return correct cipher when multiple registered", () => {
      const cipher1 = {
        id: "test1",
        name: "Test 1",
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {},
      };
      const cipher2 = {
        id: "test2",
        name: "Test 2",
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {},
      };

      registry.register(cipher1);
      registry.register(cipher2);

      expect(registry.get("test1")).toBe(cipher1);
      expect(registry.get("test2")).toBe(cipher2);
    });
  });

  describe("list", () => {
    let registry;

    beforeEach(() => {
      registry = new CipherRegistry();
    });

    it("should return empty array when no ciphers registered", () => {
      expect(registry.list()).toEqual([]);
    });

    it("should return array of all registered ciphers", () => {
      const cipher1 = {
        id: "test1",
        name: "Test 1",
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {},
      };
      const cipher2 = {
        id: "test2",
        name: "Test 2",
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {},
      };

      registry.register(cipher1);
      registry.register(cipher2);

      const list = registry.list();
      expect(list).toHaveLength(2);
      expect(list).toContain(cipher1);
      expect(list).toContain(cipher2);
    });

    it("should return new array each time", () => {
      const cipher = {
        id: "test",
        name: "Test",
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {},
      };

      registry.register(cipher);

      const list1 = registry.list();
      const list2 = registry.list();

      expect(list1).toEqual(list2);
      expect(list1).not.toBe(list2);
    });

    it("should not allow external modification of registry", () => {
      const cipher = {
        id: "test",
        name: "Test",
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {},
      };

      registry.register(cipher);
      const list = registry.list();
      list.pop();

      expect(registry.list()).toHaveLength(1);
    });
  });

  describe("integration with real ciphers", () => {
    let registry;
    let caesarCipher;
    let vigenereCipher;

    beforeAll(() => {
      const global = {};

      // Load Caesar cipher
      const caesarCode = readFileSync(
        join(process.cwd(), "js/ciphers/caesarCipher.js"),
        "utf-8"
      );
      const caesarFn = new Function("window", caesarCode);
      caesarFn(global);

      // Load Vigenere cipher
      const vigenereCode = readFileSync(
        join(process.cwd(), "js/ciphers/vigenereCipher.js"),
        "utf-8"
      );
      const vigenereFn = new Function("window", vigenereCode);
      vigenereFn(global);

      caesarCipher = global.KryptoCiphers.caesarCipher;
      vigenereCipher = global.KryptoCiphers.vigenereCipher;
    });

    beforeEach(() => {
      registry = new CipherRegistry();
    });

    it("should register caesar cipher", () => {
      expect(() => registry.register(caesarCipher)).not.toThrow();
      expect(registry.get("caesar")).toBe(caesarCipher);
    });

    it("should register vigenere cipher", () => {
      expect(() => registry.register(vigenereCipher)).not.toThrow();
      expect(registry.get("vigenere")).toBe(vigenereCipher);
    });

    it("should register both ciphers", () => {
      registry.register(caesarCipher);
      registry.register(vigenereCipher);

      expect(registry.list()).toHaveLength(2);
      expect(registry.get("caesar")).toBe(caesarCipher);
      expect(registry.get("vigenere")).toBe(vigenereCipher);
    });

    it("should allow accessing cipher methods", () => {
      registry.register(caesarCipher);
      const cipher = registry.get("caesar");

      const encrypted = cipher.encrypt("HELLO", 3);
      expect(encrypted).toBe("KHOOR");
    });
  });

  describe("edge cases", () => {
    let registry;

    beforeEach(() => {
      registry = new CipherRegistry();
    });

    it("should handle cipher with null values", () => {
      const cipher = {
        id: "test",
        name: "Test",
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {},
        optionalField: null,
      };

      expect(() => registry.register(cipher)).not.toThrow();
    });

    it("should handle cipher with empty id", () => {
      const cipher = {
        id: "",
        name: "Test",
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {},
      };

      expect(() => registry.register(cipher)).not.toThrow();
      expect(registry.get("")).toBe(cipher);
    });

    it("should handle cipher with numeric id", () => {
      const cipher = {
        id: 123,
        name: "Test",
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {},
      };

      expect(() => registry.register(cipher)).not.toThrow();
      expect(registry.get(123)).toBe(cipher);
    });

    it("should validate function fields even when they exist", () => {
      const cipher = {
        id: "test",
        name: "Test",
        encrypt: "string",
        decrypt: "string",
        crack: "string",
      };

      expect(() => registry.register(cipher)).toThrow();
    });

    it("should allow arrow functions", () => {
      const cipher = {
        id: "test",
        name: "Test",
        encrypt: (text) => text,
        decrypt: (text) => text,
        crack: (text) => ({ text }),
      };

      expect(() => registry.register(cipher)).not.toThrow();
    });

    it("should allow bound functions", () => {
      const obj = {
        method() {},
      };

      const cipher = {
        id: "test",
        name: "Test",
        encrypt: obj.method.bind(obj),
        decrypt: obj.method.bind(obj),
        crack: obj.method.bind(obj),
      };

      expect(() => registry.register(cipher)).not.toThrow();
    });
  });
});