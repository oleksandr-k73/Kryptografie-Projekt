import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

function loadRuntime() {
  const window = loadBrowserContext([
    "js/core/fileParsers.js",
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
    "js/ciphers/xorCipher.js",
  ]);
  return {
    xorCipher: window.KryptoCiphers.xorCipher,
    parseInputFile: window.KryptoCore.parseInputFile,
  };
}

describe("xor regression", () => {
  it("encrypts to HEX uppercase and decrypts back to plaintext", () => {
    const { xorCipher } = loadRuntime();
    const plaintext = "QUANTEN SPRUNG";
    const key = "KRYPTO";

    const encrypted = xorCipher.encrypt(plaintext, key);

    expect(encrypted).toBe("1A07181E000A05720A00061A0515");
    expect(encrypted).toMatch(/^[0-9A-F]+$/);
    expect(encrypted.length % 2).toBe(0);
    expect(xorCipher.decrypt(encrypted, key)).toBe(plaintext);
  });

  it("decrypt akzeptiert HEX mit Whitespace und gemischter Grossschreibung", () => {
    const { xorCipher } = loadRuntime();
    const hex = "1a07 181e 000a 0572 0A00 061A 0515";

    // Whitespace + Mixed-Case sollen die Eingabe nicht unnoetig ablehnen.
    expect(xorCipher.decrypt(hex, "KRYPTO")).toBe("QUANTEN SPRUNG");
  });

  it("parseKey lehnt leere oder nicht-ASCII Schluessel ab", () => {
    const { xorCipher } = loadRuntime();

    expect(() => xorCipher.parseKey("")).toThrow();
    expect(() => xorCipher.parseKey("KRYPTO")).not.toThrow();
    expect(() => xorCipher.parseKey("KRYPTOÖ")).toThrow();
  });

  it("parst die Beispieldatei coded_level_14.json konsistent", async () => {
    const { xorCipher, parseInputFile } = loadRuntime();
    const jsonText = JSON.stringify({
      coded: "1A07181E000A05720A00061A0515",
      meta: { hint: "fixture" },
    });

    const parsed = await parseInputFile({
      name: "coded_level_14.json",
      text: async () => jsonText,
    });
    const decrypted = xorCipher.decrypt(parsed.text, "KRYPTO");

    // JSON-Parser muss das coded-Feld finden, damit der Regression-Fall stabil bleibt.
    expect(parsed.text).toBe("1A07181E000A05720A00061A0515");
    expect(decrypted).toBe("QUANTEN SPRUNG");
  });
});
