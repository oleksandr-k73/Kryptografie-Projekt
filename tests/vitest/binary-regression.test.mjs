import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

function loadRuntime() {
  const window = loadBrowserContext([
    "js/core/fileParsers.js",
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
    "js/ciphers/binaryCipher.js",
  ]);
  return {
    binaryCipher: window.KryptoCiphers.binaryCipher,
    parseInputFile: window.KryptoCore.parseInputFile,
  };
}

function bufferToBinary(text) {
  // Buffer dient hier nur als externe Referenz fuer UTF-8-Bytes.
  return Array.from(Buffer.from(text, "utf8"))
    .map((byte) => byte.toString(2).padStart(8, "0"))
    .join(" ");
}

describe("binary (8-bit) regression", () => {
  it("encodes and decodes ASCII with the expected sample output", () => {
    const { binaryCipher } = loadRuntime();
    const plaintext = "UNSCHAERFE IM ORT";
    const expected =
      "01010101 01001110 01010011 01000011 01001000 01000001 01000101 01010010 01000110 01000101 00100000 01001001 01001101 00100000 01001111 01010010 01010100";

    // Fixer Regression-String verhindert versteckte Abweichungen im Binär-Encoding.
    expect(binaryCipher.encrypt(plaintext)).toBe(expected);
    expect(binaryCipher.decrypt(expected)).toBe(plaintext);
  });

  it("handles UTF-8 input with umlauts correctly", () => {
    const { binaryCipher } = loadRuntime();
    const plaintext = "ÜBER DEM FLUSS";
    const expected = bufferToBinary(plaintext);

    // Buffer dient hier nur als externe Referenz fuer den Standard-UTF-8-Output.
    expect(binaryCipher.encrypt(plaintext)).toBe(expected);
    expect(binaryCipher.decrypt(expected)).toBe(plaintext);
  });

  it("accepts whitespace-free input", () => {
    const { binaryCipher } = loadRuntime();
    const plaintext = "UNSCHAERFE IM ORT";
    const compact =
      "0101010101001110010100110100001101001000010000010100010101010010010001100100010100100000010010010100110100100000010011110101001001010100";

    // Decoder akzeptiert auch durchgehende 0/1-Strings, solange 8-Bit-Gruppen vorliegen.
    expect(binaryCipher.decrypt(compact)).toBe(plaintext);
  });

  it("rejects invalid length and characters", () => {
    const { binaryCipher } = loadRuntime();

    // Fehlerfaelle muessen klar abgelehnt werden, damit UI-Meldungen eindeutig bleiben.
    expect(() => binaryCipher.decrypt("0101")).toThrow();
    expect(() => binaryCipher.decrypt("01010102")).toThrow();
  });

  it("parses coded_level_20.json fixture and cracks deterministically", async () => {
    const { binaryCipher, parseInputFile } = loadRuntime();
    const fixtureText = await readFile(
      new URL("./fixtures/coded_level_20.json", import.meta.url),
      "utf8"
    );

    const parsed = await parseInputFile({
      name: "coded_level_20.json",
      text: async () => fixtureText,
    });

    const decrypted = binaryCipher.decrypt(parsed.text);
    const cracked = binaryCipher.crack(parsed.text);

    // JSON-Parser muss das coded-Feld erkennen, damit der Regression-Fall stabil bleibt.
    expect(parsed.text.trim()).toBe(
      "01010101 01001110 01010011 01000011 01001000 01000001 01000101 01010010 01000110 01000101 00100000 01001001 01001101 00100000 01001111 01010010 01010100"
    );
    expect(decrypted).toBe("UNSCHAERFE IM ORT");
    expect(cracked.key).toBe(null);
    expect(cracked.text).toBe("UNSCHAERFE IM ORT");
    expect(cracked.rawText).toBe("UNSCHAERFE IM ORT");
    expect(Number.isFinite(cracked.confidence)).toBe(true);
  });
});
