import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

function loadRuntime() {
  const window = loadBrowserContext([
    "js/core/fileParsers.js",
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
    "js/ciphers/columnarTranspositionCipher.js",
  ]);
  return {
    columnar: window.KryptoCiphers.columnarTranspositionCipher,
    parseInputFile: window.KryptoCore.parseInputFile,
  };
}

describe("columnar transposition regression", () => {
  it("encrypts by filling rows and reading columns in key order", () => {
    const { columnar } = loadRuntime();

    const encrypted = columnar.encrypt("POTENTIALTOPF MODELL", "3-1-4-2");
    const decrypted = columnar.decrypt(encrypted, "3-1-4-2");

    // Regression für die dokumentierte Columnar-Konvention.
    expect(encrypted).toBe("TIOOLPNLFEEAPDXOTTML");
    expect(decrypted).toBe("POTENTIALTOPFMODELLX");
  });

  it("parseKey accepts numeric permutations and keywords", () => {
    const { columnar } = loadRuntime();

    expect(columnar.parseKey("3-1-4-2")).toEqual([3, 1, 4, 2]);
    expect(columnar.parseKey("ZEBRA")).toEqual([5, 3, 2, 4, 1]);
    expect(() => columnar.parseKey("1-1-2")).toThrow();
    expect(() => columnar.parseKey("0-2")).toThrow();
    expect(() => columnar.parseKey("A")).toThrow();
  });

  it("decrypts and cracks the coded_level_08 fixture with key hint", async () => {
    const { columnar, parseInputFile } = loadRuntime();
    const fixtureText = await readFile(
      new URL("./fixtures/coded_level_08.json", import.meta.url),
      "utf8"
    );

    const parsed = await parseInputFile({
      name: "coded_level_08.json",
      text: async () => fixtureText,
    });

    const decrypted = columnar.decrypt(parsed.text, "3-1-4-2");
    const cracked = columnar.crack(parsed.text, { keyLength: 4 });

    expect(parsed.text).toBe("TIOOLPNLFEEAPDXOTTML");
    expect(decrypted).toBe("POTENTIALTOPFMODELLX");
    expect(cracked.key).toBe("3-1-4-2");
    expect(cracked.text).toBe("POTENTIALTOPF MODELL");
    expect(cracked.rawText).toBe("POTENTIALTOPFMODELLX");
  });
});
