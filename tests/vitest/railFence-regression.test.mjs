import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

const require = createRequire(import.meta.url);
const { generateRailFenceDataset } = require("./generators/railFenceDataset.js");

function loadRuntime() {
  const window = loadBrowserContext([
    "js/core/fileParsers.js",
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
    "js/ciphers/railFenceCipher.js",
  ]);
  return {
    railFence: window.KryptoCiphers.railFenceCipher,
    parseInputFile: window.KryptoCore.parseInputFile,
  };
}

function normalizeVisibleText(text) {
  return String(text || "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

describe("rail fence regression", () => {
  it("roundtrip keeps the complete character stream intact", () => {
    const { railFence } = loadRuntime();
    const plaintext = "Treffpunkt 07:45 Uhr, Tor 3.";

    for (let rails = 2; rails <= 10; rails += 1) {
      const encrypted = railFence.encrypt(plaintext, rails);
      const decrypted = railFence.decrypt(encrypted, rails);

      // Der Regressionstest schützt explizit Leerzeichen, Ziffern und Satzzeichen,
      // weil Rail Fence hier auf dem kompletten Zeichenstrom statt nur auf Buchstaben arbeitet.
      expect(decrypted).toBe(plaintext);
    }
  });

  it("parseKey accepts only integer rails >= 2", () => {
    const { railFence } = loadRuntime();

    expect(railFence.parseKey("2")).toBe(2);
    expect(() => railFence.parseKey("1")).toThrow();
    expect(() => railFence.parseKey("0")).toThrow();
    expect(() => railFence.parseKey("-3")).toThrow();
    expect(() => railFence.parseKey("2.5")).toThrow();
    expect(() => railFence.parseKey("abc")).toThrow();
  });

  it("hinted crack uses options.keyLength as rail count", () => {
    const { railFence } = loadRuntime();
    const plaintext = "ABITUR AUFGABE TRAINING";
    const ciphertext = railFence.encrypt(plaintext, 5);

    const cracked = railFence.crack(ciphertext, { keyLength: 5 });

    expect(cracked.key).toBe(5);
    expect(cracked.text).toBe(plaintext);
  });

  it("decrypt with known rails stays the raw inverse", () => {
    const { railFence } = loadRuntime();

    const decrypted = railFence.decrypt("PNLFEOETATPMDLTIOOL", 3);

    // decrypt() garantiert Rohtext-Inversion; Segmentierung bleibt im Crack-Pfad.
    expect(decrypted).toBe("POTENTIALTOPFMODELL");
  });

  it("unhinted crack prefers the documented YAML acceptance target", async () => {
    const { railFence, parseInputFile } = loadRuntime();
    const yamlText = `level: 6
coded: PNLFEOETATPMDLTIOOL
meta:
  source: "fixture # local"
`;

    const parsed = await parseInputFile({
      name: "coded_level_06.yaml",
      text: async () => yamlText,
    });
    const cracked = railFence.crack(parsed.text);

    expect(parsed.text).toBe("PNLFEOETATPMDLTIOOL");
    expect(cracked.key).toBe(3);
    expect(cracked.text).toBe("POTENTIALTOPF MODELL");
    expect(cracked.rawText).toBe("POTENTIALTOPFMODELL");
  });

  it("keeps mandatory seeded cases stable", () => {
    const { railFence } = loadRuntime();
    const dataset = generateRailFenceDataset(40, 42);

    for (const testCase of dataset.slice(0, 8)) {
      const cracked = railFence.crack(testCase.ciphertext, { keyLength: testCase.key });
      expect(cracked.key).toBe(testCase.key);
      expect(normalizeVisibleText(cracked.text)).toBe(normalizeVisibleText(testCase.plaintext));
    }
  });
});
