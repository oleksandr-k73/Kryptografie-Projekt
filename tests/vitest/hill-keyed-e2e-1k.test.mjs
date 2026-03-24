import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

const require = createRequire(import.meta.url);
const { generateHillDataset } = require("./generators/hillDataset.js");

function loadRuntime() {
  const window = loadBrowserContext([
    "js/ciphers/hillCipher.js",
  ]);
  return {
    hill: window.KryptoCiphers.hillCipher,
  };
}

function normalizeHillAZ(text) {
  // Die Normalisierung muss exakt den Hill-Regeln entsprechen, damit E2E-Checks stabil bleiben.
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

describe("hill keyed e2e 1k", () => {
  it("builds a deterministic 1000-case dataset", () => {
    const datasetA = generateHillDataset(1000, 42);
    const datasetB = generateHillDataset(1000, 42);
    const signatures = new Set(datasetA.map((entry) => `${entry.keyString}|${entry.plaintext}`));

    expect(datasetA).toEqual(datasetB);
    expect(datasetA).toHaveLength(1000);
    expect(signatures.has("[[3,3],[2,5]]|LICHT IMPULS")).toBe(true);
    expect(signatures.has("[[1,2,3],[0,1,4],[0,0,1]]|QUANTEN FELD ANALYSE")).toBe(true);
    expect(signatures.has("[[1,2,0,1],[0,1,3,0],[0,0,1,4],[0,0,0,1]]|LASER TRIFFT GITTER")).toBe(true);
    expect(signatures.size).toBe(1000);
  });

  it(
    "meets 1k gate: decrypt(encrypt) roundtrip for random n in {2,3,4} within 2 minutes",
    () => {
      const { hill } = loadRuntime();
      const dataset = generateHillDataset(1000, 42);
      const startedAt = Date.now();

      for (const testCase of dataset) {
        const encrypted = hill.encrypt(testCase.plaintext, testCase.matrix);
        const decrypted = hill.decrypt(encrypted, testCase.matrix);
        const normalized = normalizeHillAZ(testCase.plaintext);
        const expected = padToMultiple(normalized, testCase.matrix.length);

        expect(decrypted).toBe(expected);
      }

      const elapsedMs = Date.now() - startedAt;
      expect(elapsedMs).toBeLessThan(2 * 60 * 1000);
    },
    // Timeout > 2 Minuten, damit die Laufzeit-Assertion realistisch erreicht werden kann.
    150_000
  );
});
