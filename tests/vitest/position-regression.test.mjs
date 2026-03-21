import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

function loadRuntime() {
  const window = loadBrowserContext([
    "js/core/fileParsers.js",
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
    "js/ciphers/positionCipher.js",
  ]);
  return {
    position: window.KryptoCiphers.positionCipher,
    parseInputFile: window.KryptoCore.parseInputFile,
  };
}

describe("position cipher regression", () => {
  it("encrypts by permuting each block in key order", () => {
    const { position } = loadRuntime();

    const encrypted = position.encrypt("QUANTEN SPRUNG", "2-5-3-1-4");
    const decrypted = position.decrypt(encrypted, "2-5-3-1-4");

    // Regression für die dokumentierte Block-Permutation.
    expect(encrypted).toBe("UTAQNNRSEPNXGUX");
    expect(decrypted).toBe("QUANTENSPRUNGXX");
  });

  it("parseKey accepts numeric permutations and rejects invalid keys", () => {
    const { position } = loadRuntime();

    expect(position.parseKey("2-5-3-1-4")).toEqual([2, 5, 3, 1, 4]);
    expect(position.parseKey("2 5 3 1 4")).toEqual([2, 5, 3, 1, 4]);
    expect(() => position.parseKey("1-1-2")).toThrow();
    expect(() => position.parseKey("0-2")).toThrow();
    expect(() => position.parseKey("A")).toThrow();
  });

  it("decrypts and cracks the coded_level_17 fixture with key hint", async () => {
    const { position, parseInputFile } = loadRuntime();
    const fixtureText = await readFile(
      new URL("./fixtures/coded_level_17.xml", import.meta.url),
      "utf8"
    );

    const parsed = await parseInputFile({
      name: "coded_level_17.xml",
      text: async () => fixtureText,
    });

    const decrypted = position.decrypt(parsed.text, "2-5-3-1-4");
    const cracked = position.crack(parsed.text, { keyLength: 5 });

    expect(parsed.text).toBe("UTAQNNRSEPNXGUX");
    expect(decrypted).toBe("QUANTENSPRUNGXX");
    expect(cracked.key).toBe("2-5-3-1-4");
    expect(cracked.text).toBe("QUANTEN SPRUNG");
    expect(cracked.rawText).toBe("QUANTENSPRUNGXX");
  });
});
