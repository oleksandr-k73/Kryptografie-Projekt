import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

function loadRuntime() {
  const window = loadBrowserContext([
    "js/core/fileParsers.js",
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
    "js/ciphers/scytaleCipher.js",
  ]);
  return {
    scytale: window.KryptoCiphers.scytaleCipher,
    parseInputFile: window.KryptoCore.parseInputFile,
  };
}

describe("scytale regression", () => {
  it("encrypts by filling columns and reading rows with padding", () => {
    const { scytale } = loadRuntime();

    const encrypted = scytale.encrypt("Laser trifft Gitter", 4);
    const decrypted = scytale.decrypt(encrypted, 4);

    // Regression für die dokumentierte Skytale-Konvention.
    expect(encrypted).toBe("LTTEARGRSIIXEFTXRFTX");
    expect(decrypted).toBe("LASERTRIFFTGITTERXXX");
  });

  it("parseKey accepts only integer circumference >= 2", () => {
    const { scytale } = loadRuntime();

    expect(scytale.parseKey("2")).toBe(2);
    expect(() => scytale.parseKey("1")).toThrow();
    expect(() => scytale.parseKey("0")).toThrow();
    expect(() => scytale.parseKey("-4")).toThrow();
    expect(() => scytale.parseKey("3.5")).toThrow();
    expect(() => scytale.parseKey("abc")).toThrow();
  });

  it("decrypts and cracks the coded_level_07 fixture with key hint", async () => {
    const { scytale, parseInputFile } = loadRuntime();
    const fixtureText = (
      await readFile(new URL("./fixtures/coded_level_07.txt", import.meta.url), "utf8")
    ).trim();

    const parsed = await parseInputFile({
      name: "coded_level_07.txt",
      text: async () => fixtureText,
    });

    const decrypted = scytale.decrypt(parsed.text, 4);
    const cracked = scytale.crack(parsed.text, { keyLength: 4 });

    expect(parsed.text).toBe("LTTEARGRSIIXEFTXRFTX");
    expect(decrypted).toBe("LASERTRIFFTGITTERXXX");
    expect(cracked.key).toBe(4);
    expect(cracked.text).toBe("LASER TRIFFT GITTER");
    expect(cracked.rawText).toBe("LASERTRIFFTGITTERXXX");
  });
});
