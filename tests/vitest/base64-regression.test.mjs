import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

function loadRuntime() {
  const window = loadBrowserContext([
    "js/core/fileParsers.js",
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
    "js/ciphers/base64Cipher.js",
  ]);
  return {
    base64Cipher: window.KryptoCiphers.base64Cipher,
    parseInputFile: window.KryptoCore.parseInputFile,
  };
}

describe("base64 regression", () => {
  it("encodes and decodes ASCII with the expected sample output", () => {
    const { base64Cipher } = loadRuntime();
    const plaintext = "UNSCHAERFE IM IMPULS";
    const expected = "VU5TQ0hBRVJGRSBJTSBJTVBVTFM=";

    // Fixer Regression-String verhindert versteckte Abweichungen im Base64-Algorithmus.
    expect(base64Cipher.encrypt(plaintext)).toBe(expected);
    expect(base64Cipher.decrypt(expected)).toBe(plaintext);
  });

  it("handles UTF-8 input with umlauts correctly", () => {
    const { base64Cipher } = loadRuntime();
    const plaintext = "ÜBER DEM FLUSS";
    const expected = Buffer.from(plaintext, "utf8").toString("base64");

    // Buffer dient hier nur als externe Referenz fuer den Standard-Base64-Output.
    expect(base64Cipher.encrypt(plaintext)).toBe(expected);
    expect(base64Cipher.decrypt(expected)).toBe(plaintext);
  });

  it("accepts URL-safe input and missing padding", () => {
    const { base64Cipher } = loadRuntime();
    const plaintext = ">>>";
    const encoded = base64Cipher.encrypt(plaintext);
    const urlSafe = encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    // URL-safe Variationen und fehlendes Padding sollen entschluesselt werden koennen.
    expect(base64Cipher.decrypt(urlSafe)).toBe(plaintext);
    expect(base64Cipher.decrypt("TWE")).toBe("Ma");
  });

  it("rejects invalid length and characters", () => {
    const { base64Cipher } = loadRuntime();

    // Fehlerfaelle muessen klar abgelehnt werden, damit UI-Meldungen eindeutig bleiben.
    expect(() => base64Cipher.decrypt("AAAAA")).toThrow();
    expect(() => base64Cipher.decrypt("AA@=")).toThrow();
  });

  it("parst die Beispieldatei coded_level_15.js konsistent", async () => {
    const { base64Cipher, parseInputFile } = loadRuntime();
    const jsText = `
      const coded = "VU5TQ0hBRVJGRSBJTSBJTVBVTFM=";
      export const meta = "fixture";
    `;

    const parsed = await parseInputFile({
      name: "coded_level_15.js",
      text: async () => jsText,
    });
    const decrypted = base64Cipher.decrypt(parsed.text);

    // JS-Parser muss das coded-Feld erkennen, damit der Regression-Fall stabil bleibt.
    expect(parsed.text).toBe("VU5TQ0hBRVJGRSBJTSBJTVBVTFM=");
    expect(decrypted).toBe("UNSCHAERFE IM IMPULS");
  });

  it("crack dekodiert deterministisch und liefert Confidence", () => {
    const { base64Cipher } = loadRuntime();
    const cracked = base64Cipher.crack("VU5TQ0hBRVJGRSBJTSBJTVBVTFM=");

    // Crack bleibt keyless, liefert aber Confidence fuer das UI-Ranking.
    expect(cracked.key).toBe(null);
    expect(cracked.text).toBe("UNSCHAERFE IM IMPULS");
    expect(Number.isFinite(cracked.confidence)).toBe(true);
  });
});
