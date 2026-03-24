import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

function loadRuntime() {
  const window = loadBrowserContext([
    "js/core/fileParsers.js",
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
    "js/ciphers/hexCipher.js",
  ]);
  return {
    hexCipher: window.KryptoCiphers.hexCipher,
    parseInputFile: window.KryptoCore.parseInputFile,
  };
}

describe("hex regression", () => {
  it("encodes and decodes ASCII with the expected sample output", () => {
    const { hexCipher } = loadRuntime();
    const plaintext = "UNSCHAERFE IM IMPULS";
    const expected = "554E534348414552464520494D20494D50554C53";

    // Fixer Regression-String verhindert versteckte Abweichungen im HEX-Encoding.
    expect(hexCipher.encrypt(plaintext)).toBe(expected);
    expect(hexCipher.decrypt(expected)).toBe(plaintext);
  });

  it("handles UTF-8 input with umlauts correctly", () => {
    const { hexCipher } = loadRuntime();
    const plaintext = "ÜBER DEM FLUSS";
    const expected = Buffer.from(plaintext, "utf8").toString("hex").toUpperCase();

    // Buffer dient hier nur als externe Referenz fuer den Standard-UTF-8-Output.
    expect(hexCipher.encrypt(plaintext)).toBe(expected);
    expect(hexCipher.decrypt(expected)).toBe(plaintext);
  });

  it("accepts whitespace and mixed-case input", () => {
    const { hexCipher } = loadRuntime();
    const plaintext = "UNSCHAERFE IM IMPULS";
    const encoded = "55 4e 53 43 48 41 45 52 46 45 20 49 4d 20 49 4d 50 55 4c 53";

    // Whitespace und Mixed-Case sollen beim Decode toleriert werden.
    expect(hexCipher.decrypt(encoded)).toBe(plaintext);
  });

  it("rejects odd lengths and invalid characters", () => {
    const { hexCipher } = loadRuntime();

    // Fehlerfaelle muessen klar abgelehnt werden, damit UI-Meldungen eindeutig bleiben.
    expect(() => hexCipher.decrypt("ABC")).toThrow();
    expect(() => hexCipher.decrypt("12FG")).toThrow();
  });

  it("parses coded_level_19.txt fixture and cracks deterministically", async () => {
    const { hexCipher, parseInputFile } = loadRuntime();
    const fixtureText = await readFile(
      new URL("./fixtures/coded_level_19.txt", import.meta.url),
      "utf8"
    );

    const parsed = await parseInputFile({
      name: "coded_level_19.txt",
      text: async () => fixtureText,
    });

    const decrypted = hexCipher.decrypt(parsed.text);
    const cracked = hexCipher.crack(parsed.text);

    // TXT-Parser muss den Inhalt unveraendert liefern, damit der Regression-Fall stabil bleibt.
    expect(parsed.text.trim()).toBe("494E544552464552454E5A20414D205350414C54");
    expect(decrypted).toBe("INTERFERENZ AM SPALT");
    expect(cracked.key).toBe(null);
    expect(cracked.text).toBe("INTERFERENZ AM SPALT");
    expect(cracked.rawText).toBe("INTERFERENZ AM SPALT");
    expect(Number.isFinite(cracked.confidence)).toBe(true);
  });
});
