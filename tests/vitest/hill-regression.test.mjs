import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

function loadRuntime() {
  const window = loadBrowserContext([
    "js/core/fileParsers.js",
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
    "js/ciphers/hillCipher.js",
  ]);
  return {
    hill: window.KryptoCiphers.hillCipher,
    parseInputFile: window.KryptoCore.parseInputFile,
    dictionaryScorer: window.KryptoCore.dictionaryScorer,
  };
}

function normalizeHillAZ(text) {
  // Normalisierung spiegelt den Hill-Workflow, damit Roundtrips gegen denselben A-Z-Output geprüft werden.
  return String(text || "")
    .normalize("NFD")
    .replace(/A\u0308|Ä/gi, "AE")
    .replace(/O\u0308|Ö/gi, "OE")
    .replace(/U\u0308|Ü/gi, "UE")
    .replace(/[ßẞ]/g, "SS")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function padToMultiple(text, size) {
  const remainder = text.length % size;
  if (remainder === 0) {
    return text;
  }
  return text + "X".repeat(size - remainder);
}

describe("hill regression", () => {
  it("accepts invertible 2x2 and 3x3 matrices but rejects non-square or non-invertible keys", () => {
    const { hill } = loadRuntime();

    expect(() => hill.parseKey([[3, 3], [2, 5]])).not.toThrow();
    expect(() =>
      hill.parseKey([
        [6, 24, 1],
        [13, 16, 10],
        [20, 17, 15],
      ])
    ).not.toThrow();

    expect(() => hill.parseKey([[1, 2, 3], [4, 5, 6]])).toThrow();
    expect(() => hill.parseKey([[2, 4], [2, 4]])).toThrow();
  });

  it("parses coded_level_11 XML and decrypts to the documented example", async () => {
    const { hill, parseInputFile } = loadRuntime();
    const fixtureText = (
      await readFile(new URL("./fixtures/coded_level_11.xml", import.meta.url), "utf8")
    ).trim();

    const parsed = await parseInputFile({
      name: "coded_level_11.xml",
      text: async () => fixtureText,
    });

    const decrypted = hill.decrypt(parsed.text, [[3, 3], [2, 5]]);

    expect(parsed.text).toBe("FKBNDADVPRTV");
    expect(decrypted).toBe("LICHTIMPULSX");
  });

  it("segments LICHTIMPULS into LICHT IMPULS via dictionary scorer", () => {
    const { dictionaryScorer } = loadRuntime();

    const analysis = dictionaryScorer.analyzeTextQuality("LICHTIMPULS");
    expect(analysis.displayText).toBe("LICHT IMPULS");
  });

  it("roundtrips encrypt/decrypt with normalized and padded A-Z output", () => {
    const { hill } = loadRuntime();
    const key = [[3, 3], [2, 5]];
    const plaintext = "Quanten-Welle: Impuls";

    const encrypted = hill.encrypt(plaintext, key);
    const decrypted = hill.decrypt(encrypted, key);

    const normalized = normalizeHillAZ(plaintext);
    const expected = padToMultiple(normalized, 2);

    expect(decrypted).toBe(expected);
  });

  it("cracks a short 2x2 example with the expected key", () => {
    const { hill, dictionaryScorer } = loadRuntime();
    const key = [[3, 3], [2, 5]];
    const plaintext = "LASER TRIFFT GITTER";
    const ciphertext = hill.encrypt(plaintext, key);

    const cracked = hill.crack(ciphertext, { matrixSize: 2 });
    const expectedRaw = padToMultiple(normalizeHillAZ(plaintext), 2);
    const expectedDisplay = dictionaryScorer
      .analyzeTextQuality(expectedRaw.replace(/X+$/, ""))
      .displayText;

    expect(cracked.key).toBe("[[3,3],[2,5]]");
    expect(cracked.rawText).toBe(expectedRaw);
    expect(cracked.text).toBe(expectedDisplay);
  });
});
