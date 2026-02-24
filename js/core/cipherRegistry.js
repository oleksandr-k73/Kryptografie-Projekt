(function initCipherRegistry(global) {
  const root = global.KryptoCore || (global.KryptoCore = {});

  class CipherRegistry {
    constructor() {
      this.ciphers = new Map();
    }

    register(cipher) {
      this.assertCipherShape(cipher);
      this.ciphers.set(cipher.id, cipher);
    }

    get(id) {
      return this.ciphers.get(id);
    }

    list() {
      return Array.from(this.ciphers.values());
    }

    assertCipherShape(cipher) {
      const required = ["id", "name", "encrypt", "decrypt", "crack"];

      for (const key of required) {
        if (!(key in cipher)) {
          throw new Error(`Cipher fehlt Feld: ${key}`);
        }
      }

      const requiredFns = ["encrypt", "decrypt", "crack"];
      for (const fnName of requiredFns) {
        if (typeof cipher[fnName] !== "function") {
          throw new Error(`Cipher-Feld ${fnName} muss eine Funktion sein.`);
        }
      }
    }
  }

  root.CipherRegistry = CipherRegistry;
})(window);
