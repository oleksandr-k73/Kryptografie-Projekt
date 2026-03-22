import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

const require = createRequire(import.meta.url);
const { generateRsaMiniDataset } = require("./generators/rsaMiniDataset.js");

function loadRuntime() {
  const window = loadBrowserContext(["js/ciphers/rsaMiniCipher.js"]);
  return {
    rsaMiniCipher: window.KryptoCiphers.rsaMiniCipher,
  };
}

describe("rsa mini keyless e2e 1k", () => {
  it("builds a deterministic 1000-case dataset", () => {
    const datasetA = generateRsaMiniDataset(1000, 42);
    const datasetB = generateRsaMiniDataset(1000, 42);
    const signatures = new Set(datasetA.map((entry) => entry.plaintext));

    expect(datasetA).toEqual(datasetB);
    expect(datasetA).toHaveLength(1000);
    expect(signatures.has("53")).toBe(true);
    expect(signatures.size).toBe(1000);
  });

  it(
    "meets 1k gate: decrypt + crack successRate === 1.0, runtime < 2 minutes",
    () => {
      const { rsaMiniCipher } = loadRuntime();
      const dataset = generateRsaMiniDataset(1000, 42);
      const startedAt = Date.now();

      let decryptHits = 0;
      let crackHits = 0;

      for (const testCase of dataset) {
        const key = rsaMiniCipher.parseKey(`n=${testCase.n}, d=${testCase.d}`);
        const decrypted = rsaMiniCipher.decrypt(testCase.ciphertext, key);
        const cracked = rsaMiniCipher.crack(testCase.ciphertext, {
          d: testCase.d,
          n: testCase.n,
        });

        if (decrypted === testCase.plaintext) {
          decryptHits += 1;
        }

        if (cracked.text === testCase.plaintext) {
          crackHits += 1;
        }
      }

      const elapsedMs = Date.now() - startedAt;
      const decryptSuccessRate = decryptHits / dataset.length;
      const crackSuccessRate = crackHits / dataset.length;

      // Gate schuetzt die deterministische RSA-Entschluesselung.
      expect(decryptSuccessRate).toBe(1);
      expect(crackSuccessRate).toBe(1);
      expect(elapsedMs).toBeLessThan(2 * 60 * 1000);
    },
    150_000
  );
});
