import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load the registry module
const registryCode = readFileSync(join(process.cwd(), 'js/core/cipherRegistry.js'), 'utf8');
const global = { KryptoCore: {} };
new Function('window', registryCode)(global);
const CipherRegistry = global.KryptoCore.CipherRegistry;

describe('CipherRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new CipherRegistry();
  });

  describe('constructor', () => {
    it('should create empty registry', () => {
      expect(registry).toBeDefined();
      expect(registry.ciphers).toBeInstanceOf(Map);
      expect(registry.ciphers.size).toBe(0);
    });
  });

  describe('register', () => {
    it('should register valid cipher', () => {
      const cipher = {
        id: 'test',
        name: 'Test Cipher',
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {}
      };

      registry.register(cipher);
      expect(registry.ciphers.size).toBe(1);
      expect(registry.ciphers.get('test')).toBe(cipher);
    });

    it('should register multiple ciphers', () => {
      const cipher1 = {
        id: 'test1',
        name: 'Test 1',
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {}
      };

      const cipher2 = {
        id: 'test2',
        name: 'Test 2',
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {}
      };

      registry.register(cipher1);
      registry.register(cipher2);

      expect(registry.ciphers.size).toBe(2);
      expect(registry.ciphers.get('test1')).toBe(cipher1);
      expect(registry.ciphers.get('test2')).toBe(cipher2);
    });

    it('should overwrite cipher with same id', () => {
      const cipher1 = {
        id: 'test',
        name: 'First',
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {}
      };

      const cipher2 = {
        id: 'test',
        name: 'Second',
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {}
      };

      registry.register(cipher1);
      registry.register(cipher2);

      expect(registry.ciphers.size).toBe(1);
      expect(registry.ciphers.get('test').name).toBe('Second');
    });

    it('should throw error for missing id', () => {
      const cipher = {
        name: 'Test',
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {}
      };

      expect(() => registry.register(cipher)).toThrow('Cipher fehlt Feld: id');
    });

    it('should throw error for missing name', () => {
      const cipher = {
        id: 'test',
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {}
      };

      expect(() => registry.register(cipher)).toThrow('Cipher fehlt Feld: name');
    });

    it('should throw error for missing encrypt', () => {
      const cipher = {
        id: 'test',
        name: 'Test',
        decrypt: () => {},
        crack: () => {}
      };

      expect(() => registry.register(cipher)).toThrow('Cipher fehlt Feld: encrypt');
    });

    it('should throw error for missing decrypt', () => {
      const cipher = {
        id: 'test',
        name: 'Test',
        encrypt: () => {},
        crack: () => {}
      };

      expect(() => registry.register(cipher)).toThrow('Cipher fehlt Feld: decrypt');
    });

    it('should throw error for missing crack', () => {
      const cipher = {
        id: 'test',
        name: 'Test',
        encrypt: () => {},
        decrypt: () => {}
      };

      expect(() => registry.register(cipher)).toThrow('Cipher fehlt Feld: crack');
    });

    it('should throw error if encrypt is not a function', () => {
      const cipher = {
        id: 'test',
        name: 'Test',
        encrypt: 'not a function',
        decrypt: () => {},
        crack: () => {}
      };

      expect(() => registry.register(cipher)).toThrow('Cipher-Feld encrypt muss eine Funktion sein');
    });

    it('should throw error if decrypt is not a function', () => {
      const cipher = {
        id: 'test',
        name: 'Test',
        encrypt: () => {},
        decrypt: 123,
        crack: () => {}
      };

      expect(() => registry.register(cipher)).toThrow('Cipher-Feld decrypt muss eine Funktion sein');
    });

    it('should throw error if crack is not a function', () => {
      const cipher = {
        id: 'test',
        name: 'Test',
        encrypt: () => {},
        decrypt: () => {},
        crack: null
      };

      expect(() => registry.register(cipher)).toThrow('Cipher-Feld crack muss eine Funktion sein');
    });

    it('should accept cipher with optional fields', () => {
      const cipher = {
        id: 'test',
        name: 'Test',
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {},
        supportsKey: true,
        info: { purpose: 'Test' }
      };

      expect(() => registry.register(cipher)).not.toThrow();
    });
  });

  describe('get', () => {
    it('should retrieve registered cipher', () => {
      const cipher = {
        id: 'test',
        name: 'Test',
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {}
      };

      registry.register(cipher);
      expect(registry.get('test')).toBe(cipher);
    });

    it('should return undefined for non-existent cipher', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('should return undefined when registry is empty', () => {
      expect(registry.get('test')).toBeUndefined();
    });

    it('should retrieve correct cipher when multiple registered', () => {
      const cipher1 = {
        id: 'test1',
        name: 'Test 1',
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {}
      };

      const cipher2 = {
        id: 'test2',
        name: 'Test 2',
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {}
      };

      registry.register(cipher1);
      registry.register(cipher2);

      expect(registry.get('test1')).toBe(cipher1);
      expect(registry.get('test2')).toBe(cipher2);
    });
  });

  describe('list', () => {
    it('should return empty array when no ciphers registered', () => {
      const list = registry.list();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBe(0);
    });

    it('should return array of all registered ciphers', () => {
      const cipher1 = {
        id: 'test1',
        name: 'Test 1',
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {}
      };

      const cipher2 = {
        id: 'test2',
        name: 'Test 2',
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {}
      };

      registry.register(cipher1);
      registry.register(cipher2);

      const list = registry.list();
      expect(list.length).toBe(2);
      expect(list).toContain(cipher1);
      expect(list).toContain(cipher2);
    });

    it('should return new array each time', () => {
      const cipher = {
        id: 'test',
        name: 'Test',
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {}
      };

      registry.register(cipher);

      const list1 = registry.list();
      const list2 = registry.list();

      expect(list1).not.toBe(list2);
      expect(list1).toEqual(list2);
    });

    it('should not affect registry when modifying returned array', () => {
      const cipher = {
        id: 'test',
        name: 'Test',
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {}
      };

      registry.register(cipher);

      const list = registry.list();
      list.pop();

      expect(registry.list().length).toBe(1);
    });
  });

  describe('assertCipherShape', () => {
    it('should not throw for valid cipher', () => {
      const cipher = {
        id: 'test',
        name: 'Test',
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {}
      };

      expect(() => registry.assertCipherShape(cipher)).not.toThrow();
    });

    it('should throw for null cipher', () => {
      expect(() => registry.assertCipherShape(null)).toThrow();
    });

    it('should throw for undefined cipher', () => {
      expect(() => registry.assertCipherShape(undefined)).toThrow();
    });

    it('should throw for non-object cipher', () => {
      expect(() => registry.assertCipherShape('not an object')).toThrow();
      expect(() => registry.assertCipherShape(123)).toThrow();
      expect(() => registry.assertCipherShape(true)).toThrow();
    });

    it('should throw for array instead of object', () => {
      expect(() => registry.assertCipherShape([])).toThrow();
    });
  });

  describe('integration', () => {
    it('should handle typical usage scenario', () => {
      const caesar = {
        id: 'caesar',
        name: 'Caesar',
        encrypt: (text, key) => text,
        decrypt: (text, key) => text,
        crack: (text) => ({ key: 0, text })
      };

      const vigenere = {
        id: 'vigenere',
        name: 'Vigenere',
        encrypt: (text, key) => text,
        decrypt: (text, key) => text,
        crack: (text) => ({ key: 'A', text })
      };

      registry.register(caesar);
      registry.register(vigenere);

      expect(registry.list().length).toBe(2);
      expect(registry.get('caesar').name).toBe('Caesar');
      expect(registry.get('vigenere').name).toBe('Vigenere');

      const caesarResult = registry.get('caesar').encrypt('test', 3);
      expect(caesarResult).toBe('test');
    });

    it('should handle cipher with all optional fields', () => {
      const cipher = {
        id: 'full',
        name: 'Full Cipher',
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {},
        supportsKey: true,
        supportsCrackLengthHint: true,
        keyLabel: 'Key',
        keyPlaceholder: 'Enter key',
        crackLengthLabel: 'Length',
        crackLengthPlaceholder: 'Enter length',
        info: {
          purpose: 'Test purpose',
          process: 'Test process',
          crack: 'Test crack',
          useCase: 'Test use case'
        }
      };

      registry.register(cipher);
      const retrieved = registry.get('full');

      expect(retrieved.supportsKey).toBe(true);
      expect(retrieved.supportsCrackLengthHint).toBe(true);
      expect(retrieved.info.purpose).toBe('Test purpose');
    });
  });

  describe('edge cases', () => {
    it('should handle cipher with empty id', () => {
      const cipher = {
        id: '',
        name: 'Test',
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {}
      };

      expect(() => registry.register(cipher)).not.toThrow();
      expect(registry.get('')).toBe(cipher);
    });

    it('should handle cipher with special characters in id', () => {
      const cipher = {
        id: 'test-cipher_123',
        name: 'Test',
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {}
      };

      registry.register(cipher);
      expect(registry.get('test-cipher_123')).toBe(cipher);
    });

    it('should handle cipher with empty name', () => {
      const cipher = {
        id: 'test',
        name: '',
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {}
      };

      expect(() => registry.register(cipher)).not.toThrow();
    });

    it('should handle cipher with unicode in name', () => {
      const cipher = {
        id: 'test',
        name: 'Тест 测试 🔐',
        encrypt: () => {},
        decrypt: () => {},
        crack: () => {}
      };

      registry.register(cipher);
      expect(registry.get('test').name).toBe('Тест 测试 🔐');
    });

    it('should handle many ciphers', () => {
      for (let i = 0; i < 100; i++) {
        const cipher = {
          id: `cipher${i}`,
          name: `Cipher ${i}`,
          encrypt: () => {},
          decrypt: () => {},
          crack: () => {}
        };
        registry.register(cipher);
      }

      expect(registry.list().length).toBe(100);
      expect(registry.get('cipher0')).toBeDefined();
      expect(registry.get('cipher99')).toBeDefined();
    });
  });
});