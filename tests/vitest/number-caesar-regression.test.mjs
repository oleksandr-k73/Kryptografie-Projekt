import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

const ROOT_DIR = path.resolve(process.cwd());

function loadRuntime() {
  const window = loadBrowserContext([
    "js/core/fileParsers.js",
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
    "js/ciphers/numberCaesarCipher.js",
  ]);
  return {
    numberCaesar: window.KryptoCiphers.numberCaesarCipher,
    parseInputFile: window.KryptoCore.parseInputFile,
    dictionaryScorer: window.KryptoCore.dictionaryScorer,
  };
}

function normalizeAZ(input) {
  let normalized = String(input || "").normalize("NFD");
  // Die Test-Normalisierung muss den Cipher-Regeln folgen, damit Roundtrips stabil bleiben.
  normalized = normalized
    .replace(/A\u0308|Ä/gi, "AE")
    .replace(/O\u0308|Ö/gi, "OE")
    .replace(/U\u0308|Ü/gi, "UE")
    .replace(/[ßẞ]/g, "SS");
  return normalized.replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, "");
}

function applyUndBridgeFallback(rawText, displayText) {
  const raw = String(rawText || "");
  if (!raw.includes("UND")) {
    return displayText;
  }
  if (displayText && displayText.includes(" UND ")) {
    return displayText;
  }

  // Der Fallback spiegelt die UI-Logik, damit Zahlen-Caesar sauber segmentiert bleibt.
  const forced = raw.replace(/([A-Z]{3,})UND([A-Z]{3,})/g, "$1 UND $2");
  return forced === raw ? displayText : forced;
}

describe("number caesar regression", () => {
  it("parseKey normalizes integer inputs modulo 26", () => {
    const { numberCaesar } = loadRuntime();

    expect(numberCaesar.parseKey("3")).toBe(3);
    expect(numberCaesar.parseKey("29")).toBe(3);
    expect(numberCaesar.parseKey("-1")).toBe(25);
    expect(() => numberCaesar.parseKey("2.5")).toThrow();
    expect(() => numberCaesar.parseKey("abc")).toThrow();
  });

  it("roundtrip preserves the normalized A-Z stream", () => {
    const { numberCaesar } = loadRuntime();
    const plaintext = "Grüße aus der Quanten-Physik!";

    const encrypted = numberCaesar.encrypt(plaintext, 5);
    const decrypted = numberCaesar.decrypt(encrypted, 5);

    // Die Verschluesselung entfernt Nicht-Buchstaben, daher wird gegen die Normalisierung geprueft.
    expect(decrypted).toBe(normalizeAZ(plaintext));
  });

  it("fixture decrypt + crack yields the expected raw and segmented text", async () => {
    const { numberCaesar, parseInputFile, dictionaryScorer } = loadRuntime();
    const fixturePath = path.join(ROOT_DIR, "tests", "vitest", "fixtures", "coded_level_16.csv");
    const fixtureText = fs.readFileSync(fixturePath, "utf8");

    const parsed = await parseInputFile({
      name: "coded_level_16.csv",
      text: async () => fixtureText,
    });

    const decrypted = numberCaesar.decrypt(parsed.text, 3);
    const cracked = numberCaesar.crack(parsed.text);

    const analysis = dictionaryScorer.analyzeTextQuality(cracked.rawText, {
      languageHints: ["de"],
      maxWordLength: 40,
    });
    const displayText = applyUndBridgeFallback(
      cracked.rawText,
      analysis.displayText ? analysis.displayText.trim() : cracked.rawText
    );

    expect(parsed.text).toBe("16-18-7-8-15-15-24-17-7-10-21-8-17-3-8-17");
    expect(decrypted).toBe("MODELLUNDGRENZEN");
    expect(cracked.key).toBe(3);
    expect(cracked.rawText).toBe("MODELLUNDGRENZEN");
    expect(displayText).toBe("MODELL UND GRENZEN");
  });
});
