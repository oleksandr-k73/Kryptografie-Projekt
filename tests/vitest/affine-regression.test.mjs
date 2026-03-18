import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

function loadRuntime() {
  const window = loadBrowserContext([
    "js/core/fileParsers.js",
    "js/ciphers/affineCipher.js",
  ]);
  return {
    affine: window.KryptoCiphers.affineCipher,
    parseInputFile: window.KryptoCore.parseInputFile,
  };
}

describe("affine regression", () => {
  it("parseKey accepts (a,b) pairs and rejects non-coprime a", () => {
    const { affine } = loadRuntime();

    // Gültiges Beispiel mit Standardalphabet (m=26).
    expect(affine.parseKey("5,8", { alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" })).toEqual({
      a: 5,
      b: 8,
      alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      toString: expect.any(Function),
    });

    // 13 teilt 26 -> kein inverses Element vorhanden.
    expect(() => affine.parseKey("13,8", { alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" })).toThrow();
  });

  it("preserves case on encrypt/decrypt roundtrip", () => {
    const { affine } = loadRuntime();
    const key = affine.parseKey("5,8", { alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" });
    const input = "Abc xyz!";

    const encrypted = affine.encrypt(input, key);
    const decrypted = affine.decrypt(encrypted, key);

    expect(decrypted).toBe(input);
  });

  it("cracks the coded_level_10 fixture", async () => {
    const { affine, parseInputFile } = loadRuntime();
    const fixtureText = await readFile(
      new URL("./fixtures/coded_level_10.csv", import.meta.url),
      "utf8"
    );

    const parsed = await parseInputFile({
      name: "coded_level_10.csv",
      text: async () => fixtureText,
    });

    // Regression für den erwarteten Klartext aus dem Fixture.
    const cracked = affine.crack(parsed.text, { alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" });
    expect(parsed.text).toBe("OIRPUSRCWVLWSRGCWZUXWSRZC");
    expect(cracked.text).toBe("WAHRSCHEINLICHKEITSDICHTE");
  });

  it("roundtrips with a custom alphabet", () => {
    const { affine } = loadRuntime();
    const alphabet = "ABCDEF123";
    const key = affine.parseKey("5,2", { alphabet });
    const input = "FACE 123";

    const encrypted = affine.encrypt(input, key);
    const decrypted = affine.decrypt(encrypted, key);

    expect(decrypted).toBe(input);
  });
});
