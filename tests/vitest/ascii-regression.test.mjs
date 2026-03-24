import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

function loadRuntime() {
  const window = loadBrowserContext([
    "js/core/fileParsers.js",
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
    "js/ciphers/asciiCipher.js",
  ]);
  return {
    asciiCipher: window.KryptoCiphers.asciiCipher,
    parseInputFile: window.KryptoCore.parseInputFile,
  };
}

describe("ascii regression", () => {
  it("encodes and decodes ASCII with the expected sample output", () => {
    const { asciiCipher } = loadRuntime();
    const plaintext = "LASER TRIFFT GITTER";
    const expected = "76 65 83 69 82 32 84 82 73 70 70 84 32 71 73 84 84 69 82";

    // Fixer Regression-String verhindert versteckte Abweichungen im Encoding.
    expect(asciiCipher.encrypt(plaintext)).toBe(expected);
    expect(asciiCipher.decrypt(expected)).toBe(plaintext);
  });

  it("rejects non-numeric input and out-of-range values", () => {
    const { asciiCipher } = loadRuntime();

    // Fehlerfaelle muessen klar abgelehnt werden, damit UI-Meldungen stabil bleiben.
    expect(() => asciiCipher.decrypt("65 A")).toThrow();
    expect(() => asciiCipher.decrypt("256")).toThrow();
  });

  it("returns empty output for empty input", () => {
    const { asciiCipher } = loadRuntime();

    // Leere Eingaben sollen nicht als Fehler gewertet werden.
    expect(asciiCipher.decrypt("")).toBe("");
    expect(asciiCipher.decrypt("   \n\t")).toBe("");
  });

  it("parses coded_level_18 YAML fixture and cracks deterministically", async () => {
    const { asciiCipher, parseInputFile } = loadRuntime();
    const fixtureText = await readFile(
      new URL("./fixtures/coded_level_18.yaml", import.meta.url),
      "utf8"
    );

    const parsed = await parseInputFile({
      name: "coded_level_18.yaml",
      text: async () => fixtureText,
    });

    const decrypted = asciiCipher.decrypt(parsed.text);
    const cracked = asciiCipher.crack(parsed.text);

    // YAML-Parser muss das coded-Feld erkennen, damit der Regression-Fall stabil bleibt.
    expect(parsed.text).toBe(
      "76 65 83 69 82 32 84 82 73 70 70 84 32 71 73 84 84 69 82"
    );
    expect(decrypted).toBe("LASER TRIFFT GITTER");
    expect(cracked.key).toBe(null);
    expect(cracked.text).toBe("LASER TRIFFT GITTER");
    expect(cracked.rawText).toBe("LASER TRIFFT GITTER");
    expect(Number.isFinite(cracked.confidence)).toBe(true);
  });
});
