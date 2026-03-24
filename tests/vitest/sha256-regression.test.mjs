import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";
import crypto from "node:crypto";

const require = createRequire(import.meta.url);

function loadRuntime() {
  const window = loadBrowserContext([
    "js/core/fileParsers.js",
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
    "js/ciphers/sha256Cipher.js",
  ]);
  return {
    sha256Cipher: window.KryptoCiphers.sha256Cipher,
    parseInputFile: window.KryptoCore.parseInputFile,
  };
}

function nodeHash(text) {
  // Node crypto ist die Referenz für die erwarteten Hashwerte.
  // Damit werden die Testergebnisse unabhängig von der Browser-Implementierung überprüfbar.
  const hash = crypto.createHash("sha256");
  hash.update(text, "utf8");
  return hash.digest("hex").toUpperCase();
}

describe("sha256 regression", () => {
  it("hashes the sample plaintext correctly", () => {
    const { sha256Cipher } = loadRuntime();
    const plaintext = "MELDE DICH BEI DER LEHRKRAFT WENN DU DEN TOKEN GEFUNDEN HAST";
    const expected = nodeHash(plaintext);

    // Fixer Regression-String verhindert versteckte Abweichungen im SHA-256-Hashing.
    expect(sha256Cipher.encrypt(plaintext)).toBe(expected);
  });

  it("handles UTF-8 input with umlauts correctly", () => {
    const { sha256Cipher } = loadRuntime();
    const plaintext = "ÜBER DEM FLUSS";
    const expected = nodeHash(plaintext);

    // node crypto dient als externe Referenz für den Standard-UTF-8-Output.
    expect(sha256Cipher.encrypt(plaintext)).toBe(expected);
  });

  it("rejects invalid hash input in decrypt mode", () => {
    const { sha256Cipher } = loadRuntime();

    // decrypt ist nicht implementiert; es muss ein klarer Fehler geworfen werden.
    expect(() => sha256Cipher.decrypt("ABC")).toThrow();
    expect(() => sha256Cipher.decrypt("nicht64hexzeichen")).toThrow();
  });

  it("rejects invalid hash input in crack without candidates", () => {
    const { sha256Cipher } = loadRuntime();
    const cracked = sha256Cipher.crack("ABC", {});

    // Ungültige Eingabe führt zu WIP, nicht zu Farce-Output.
    expect(cracked.search.wip).toBe(true);
    expect(cracked.search.wipMessage).toContain("nicht gültiger");
  });

  it("cracks with matching candidates returns plaintext", () => {
    const { sha256Cipher } = loadRuntime();
    const plaintext = "UNSCHAERFE IM IMPULS";
    const hash = sha256Cipher.encrypt(plaintext);

    const cracked = sha256Cipher.crack(hash, {
      candidates: [plaintext, "OTHER TEXT"],
    });

    // Crack mit Kandidaten sollte die Plaintext finden, wenn sie in der Liste ist.
    expect(cracked.text).toBe(plaintext);
    expect(cracked.confidence).toBe(100);
    expect(cracked.candidates).toHaveLength(1);
    expect(cracked.candidates[0].text).toBe(plaintext);
  });

  it("crack without candidates returns WIP", () => {
    const { sha256Cipher } = loadRuntime();
    const plaintext = "UNSCHAERFE IM IMPULS";
    const hash = sha256Cipher.encrypt(plaintext);

    const cracked = sha256Cipher.crack(hash, {});

    // Ohne Kandidatenliste ist Knacken noch nicht implementiert, daher WIP.
    expect(cracked.search.wip).toBe(true);
    expect(cracked.search.wipMessage).toContain("Work in Progress");
  });

  it("crack with non-matching candidates returns WIP", () => {
    const { sha256Cipher } = loadRuntime();
    const plaintext = "UNSCHAERFE IM IMPULS";
    const hash = sha256Cipher.encrypt(plaintext);

    const cracked = sha256Cipher.crack(hash, {
      candidates: ["WRONG TEXT", "OTHER TEXT"],
    });

    // Kein Match in den Kandidaten führt zu WIP, nicht zu Farce-Output.
    expect(cracked.search.wip).toBe(true);
    expect(cracked.search.wipMessage).toContain("Keine Plaintext");
  });

  it("parses coded_level_24.yaml fixture correctly", async () => {
    const { sha256Cipher, parseInputFile } = loadRuntime();
    const fixtureText = await readFile(
      new URL("./fixtures/coded_level_24.yaml", import.meta.url),
      "utf8"
    );

    const parsed = await parseInputFile({
      name: "coded_level_24.yaml",
      text: async () => fixtureText,
    });

    // YAML-Parser muss den "coded"-Wert extrahieren, nicht den ganzen YAML-Text.
    const plaintext = parsed.text;
    expect(plaintext).toBe("MELDE DICH BEI DER LEHRKRAFT WENN DU DEN TOKEN GEFUNDEN HAST");

    const hash = sha256Cipher.encrypt(plaintext);
    expect(hash).toBe(nodeHash(plaintext));
  });

  it("hashing returns uppercase 64-char hex string", () => {
    const { sha256Cipher } = loadRuntime();
    const plaintext = "TEST";
    const hash = sha256Cipher.encrypt(plaintext);

    // SHA-256 muss exakt 64 Zeichen Hexadezimal liefern, alle Großbuchstaben.
    expect(hash).toMatch(/^[A-F0-9]{64}$/);
  });

  it("WIP message is properly formatted", () => {
    const { sha256Cipher } = loadRuntime();
    const validHash = "5CB87B78DD8D8FBB3B6A1E7B95ECD2E2D1B8E3C4A9F2E3D4C5B6A7E8F9D0C1B2"; // 64 hex chars
    const cracked = sha256Cipher.crack(validHash, {});

    // WIP-Meldung sollte informativ sein und nicht leer sein.
    expect(cracked.search.wip).toBe(true);
    expect(typeof cracked.search.wipMessage).toBe("string");
    expect(cracked.search.wipMessage.length).toBeGreaterThan(0);
  });
});
