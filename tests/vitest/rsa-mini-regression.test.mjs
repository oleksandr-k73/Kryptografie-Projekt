import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

function loadRuntime() {
  const window = loadBrowserContext(["js/ciphers/rsaMiniCipher.js"]);
  return {
    rsaMiniCipher: window.KryptoCiphers.rsaMiniCipher,
  };
}

describe("rsa mini regression", () => {
  it("encrypts and decrypts the mandatory sample", () => {
    const { rsaMiniCipher } = loadRuntime();
    const key = rsaMiniCipher.parseKey("p=11, q=17, n=187, e=7, d=23");

    // Fixer Beispielwert schuetzt gegen Aenderungen in der ModPow-Logik.
    expect(rsaMiniCipher.encrypt("53", key)).toBe("26");
    expect(rsaMiniCipher.decrypt("26", key)).toBe("53");
  });

  it("cracks with d,n hint deterministically", () => {
    const { rsaMiniCipher } = loadRuntime();

    const cracked = rsaMiniCipher.crack("26", { d: 23, n: 187 });

    // Crack bleibt deterministisch, damit der Hint-Pfad stabil bleibt.
    expect(cracked.text).toBe("53");
    expect(cracked.key).toBe("d=23, n=187");
    expect(cracked.confidence).toBe(1);
  });

  it("parses labeled and unlabeled key strings", () => {
    const { rsaMiniCipher } = loadRuntime();

    const labeled = rsaMiniCipher.parseKey("p=11, q=17, n=187, e=7, d=23");
    const unlabeled = rsaMiniCipher.parseKey("11 17 187 7 23");

    // Beide Pfade sollen denselben Schluessel liefern, damit UI-Tests konsistent bleiben.
    expect(labeled.n.toString()).toBe("187");
    expect(unlabeled.n.toString()).toBe("187");
    expect(labeled.d.toString()).toBe("23");
    expect(unlabeled.e.toString()).toBe("7");
  });

  it("rejects mismatched n and non-coprime e", () => {
    const { rsaMiniCipher } = loadRuntime();

    // Widerspruechliche Parameter sollen frueh geblockt werden.
    expect(() => rsaMiniCipher.parseKey("p=11, q=17, n=188, e=7")).toThrow();

    // e muss teilerfremd zu phi sein, sonst existiert kein d.
    expect(() => rsaMiniCipher.parseKey("p=11, q=17, e=10")).toThrow();
  });

  it("rejects tokens outside 0..n-1", () => {
    const { rsaMiniCipher } = loadRuntime();
    const key = rsaMiniCipher.parseKey("p=11, q=17, n=187, e=7, d=23");

    // Range-Guards schuetzen gegen ungueltige RSA-Zustaende.
    expect(() => rsaMiniCipher.encrypt("187", key)).toThrow();
  });
});
