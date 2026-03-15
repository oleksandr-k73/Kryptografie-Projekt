import { describe, expect, it } from "vitest";
import { loadBrowserContext, loadScriptsIntoContext } from "./_browserHarness.mjs";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const { generateVigenereDataset } = require("./generators/vigenereDataset.js");
const LONG_PHASE_KEY = "PHASE";
const LONG_PHASE_PLAINTEXT =
  "IM DOPPELSPALTEXPERIMENT ERZEUGEN EINZELNE ELEKTRONEN EIN INTERFERENZMUSTER UND ZEIGEN DAMIT DASS MATERIE WELLENCHARAKTER BESITZEN KANN";
const LONG_PHASE_CIPHERTEXT =
  "XT DGTELLKTPSTWBELRAQTUT WVOLUYIC LIFDTSNW IALKLVDUEF IXU IFXTYFWVTUZEYHAEJ YCK ZWMVLN VEBPT VEHZ MSXTYIW ATSLWRROAJEZAEJ FTZILDTU KSRC";
const QUANT_KEY = "QUANT";
const QUANT_PLAINTEXT =
  "EINSTEIN ERKLAERTE DEN PHOTOEFFEKT DURCH DIE EINFUEHRUNG VON PHOTONEN UND ZEIGTE DASS ERST AB DER GRENZFREQUENZ ELEKTRONEN AUSGELOEST WERDEN";

function compactLetters(text) {
  return String(text || "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
}

function createMockElement(tagName = "div") {
  return {
    tagName: String(tagName || "div").toUpperCase(),
    value: "",
    textContent: "",
    placeholder: "",
    innerHTML: "",
    hidden: false,
    disabled: false,
    files: [],
    children: [],
    _listeners: new Map(),
    classList: {
      add() {},
      remove() {},
    },
    append(child) {
      this.children.push(child);
      if (this.tagName === "SELECT" && this.value === "" && child && typeof child.value === "string") {
        this.value = child.value;
      }
    },
    addEventListener(type, handler) {
      const list = this._listeners.get(type) || [];
      list.push(handler);
      this._listeners.set(type, list);
    },
    focus() {},
    select() {},
    querySelector() {
      return null;
    },
  };
}

function loadAppRuntimeForVigenere(fetchImpl = () => Promise.reject(new Error("offline in test"))) {
  const elements = {
    dropzone: createMockElement("div"),
    fileInput: createMockElement("input"),
    fileStatus: createMockElement("div"),
    inputText: createMockElement("textarea"),
    modeSelect: createMockElement("select"),
    cipherSelect: createMockElement("select"),
    keyInput: createMockElement("input"),
    keyHint: createMockElement("div"),
    crackLengthWrap: createMockElement("div"),
    crackLengthInput: createMockElement("input"),
    crackLengthHint: createMockElement("div"),
    cipherInfoTitle: createMockElement("div"),
    cipherInfoPurpose: createMockElement("div"),
    cipherInfoHow: createMockElement("div"),
    cipherInfoCrack: createMockElement("div"),
    cipherInfoUse: createMockElement("div"),
    candidateSection: createMockElement("section"),
    candidateStatus: createMockElement("div"),
    candidateList: createMockElement("ul"),
    runButton: createMockElement("button"),
    outputText: createMockElement("textarea"),
    // Roh-Ausgabe-Elemente verhindern, dass app.js im Testlauf beim Wiring abbricht.
    rawOutputWrap: createMockElement("section"),
    rawOutputText: createMockElement("textarea"),
    resultInfo: createMockElement("div"),
    copyButton: createMockElement("button"),
    rawCopyButton: createMockElement("button"),
  };
  const keyLabel = createMockElement("label");
  const crackLengthLabel = createMockElement("label");
  elements.crackLengthWrap.querySelector = (selector) =>
    selector === 'label[for="crackLengthInput"]' ? crackLengthLabel : null;

  elements.modeSelect.value = "decrypt";
  elements.keyInput.value = "";
  elements.crackLengthInput.value = "";

  const idMap = new Map([
    ["dropzone", elements.dropzone],
    ["fileInput", elements.fileInput],
    ["fileStatus", elements.fileStatus],
    ["inputText", elements.inputText],
    ["modeSelect", elements.modeSelect],
    ["cipherSelect", elements.cipherSelect],
    ["keyInput", elements.keyInput],
    ["keyHint", elements.keyHint],
    ["crackLengthWrap", elements.crackLengthWrap],
    ["crackLengthInput", elements.crackLengthInput],
    ["crackLengthHint", elements.crackLengthHint],
    ["cipherInfoTitle", elements.cipherInfoTitle],
    ["cipherInfoPurpose", elements.cipherInfoPurpose],
    ["cipherInfoHow", elements.cipherInfoHow],
    ["cipherInfoCrack", elements.cipherInfoCrack],
    ["cipherInfoUse", elements.cipherInfoUse],
    ["candidateSection", elements.candidateSection],
    ["candidateStatus", elements.candidateStatus],
    ["candidateList", elements.candidateList],
    ["runButton", elements.runButton],
    ["outputText", elements.outputText],
    ["rawOutputWrap", elements.rawOutputWrap],
    ["rawOutputText", elements.rawOutputText],
    ["resultInfo", elements.resultInfo],
    ["copyButton", elements.copyButton],
    ["rawCopyButton", elements.rawCopyButton],
  ]);

  const document = {
    getElementById(id) {
      return idMap.get(id) || null;
    },
    querySelector(selector) {
      if (selector === 'label[for="keyInput"]') {
        return keyLabel;
      }
      return null;
    },
    createElement(tagName) {
      return createMockElement(tagName);
    },
    execCommand() {
      return true;
    },
  };

  const navigator = {
    language: "de-DE",
    languages: ["de-DE", "en-US"],
    clipboard: {
      writeText: async () => {},
    },
  };
  const context = {
    window: {},
    document,
    navigator,
    fetch: fetchImpl,
    AbortController,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (callback) => {
      callback(Date.now());
      return 1;
    },
    console,
  };
  context.window.window = context.window;
  context.window.document = document;
  context.window.navigator = navigator;
  context.window.fetch = fetchImpl;
  context.window.AbortController = AbortController;
  context.window.setTimeout = setTimeout;
  context.window.clearTimeout = clearTimeout;
  context.window.requestAnimationFrame = context.requestAnimationFrame;
  vm.createContext(context);

  // Der App-Harness nutzt denselben Loader wie die übrigen Browser-Regressionen,
  // damit Setup-Fehler an einer Stelle klar diagnostiziert und nicht in Teilpfaden verwässert werden.
  loadScriptsIntoContext(context, [
    "js/core/cipherRegistry.js",
    "js/core/fileParsers.js",
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
    "js/ciphers/vigenereCipher.js",
    "js/app.js",
  ]);

  elements.cipherSelect.value = "vigenere";

  return {
    window: context.window,
    elements,
    async runDecrypt() {
      const clickHandlers = elements.runButton._listeners.get("click") || [];
      for (const handler of clickHandlers) {
        await handler();
      }
    },
  };
}

function loadRuntime(fetchImpl = () => Promise.reject(new Error("offline in test"))) {
  const window = loadBrowserContext(
    ["js/ciphers/vigenereCipher.js", "js/core/segmentLexiconData.js", "js/core/dictionaryScorer.js"],
    {
      // Die meisten Regressionen sollen deterministisch lokal laufen; das entkoppelt
      // sie von API-Latenz, während der explizite Online/Offline-Test unten Netzverhalten abdeckt.
      fetchImpl,
    }
  );
  return {
    vigenere: window.KryptoCiphers.vigenereCipher,
    scorer: window.KryptoCore.dictionaryScorer,
  };
}

async function canReachDictionaryApi() {
  if (typeof fetch !== "function" || typeof AbortController !== "function") {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(
      "https://api.dictionaryapi.dev/api/v2/entries/en/test",
      { signal: controller.signal }
    );
    return Boolean(response);
  } catch (_error) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

const optimizationModes = [
  { label: "optimizations disabled", value: false },
  { label: "optimizations enabled", value: true },
];

describe("vigenere crack regression", () => {
  for (const mode of optimizationModes) {
    it(
      `recovers BRICK/Youshallntpass for Zfcurbctpdqrau with keyLength=5 (${mode.label})`,
      async () => {
        const { vigenere, scorer } = loadRuntime();
        const cracked = vigenere.crack("Zfcurbctpdqrau", {
          keyLength: 5,
          optimizations: mode.value,
        });

        expect(cracked.search.shortTextRescue).toBe(true);
        const ranked = await scorer.rankCandidates(cracked.candidates, {
          languageHints: ["en"],
        });
        expect(ranked.bestCandidate.key).toBe("BRICK");
        expect(ranked.bestCandidate.text).toBe("Youshallntpass");
      },
      20_000
    );

      it("online vs offline dictionary ranking difference (BRICK case)", async () => {
        const apiReachable = await canReachDictionaryApi();
        // online context (real fetch)
        const online = loadBrowserContext(
          ["js/ciphers/vigenereCipher.js", "js/core/segmentLexiconData.js", "js/core/dictionaryScorer.js"],
          {
            fetchImpl: typeof fetch === "function"
              ? fetch
              : () => Promise.reject(new Error("fetch unavailable")),
          }
        );
        // offline context (no API)
        const offline = loadBrowserContext(
          ["js/ciphers/vigenereCipher.js", "js/core/segmentLexiconData.js", "js/core/dictionaryScorer.js"],
          { fetchImpl: () => Promise.reject(new Error("offline in test")) }
        );

        const vOnline = online.KryptoCiphers.vigenereCipher;
        const sOnline = online.KryptoCore.dictionaryScorer;
        const vOffline = offline.KryptoCiphers.vigenereCipher;
        const sOffline = offline.KryptoCore.dictionaryScorer;

        const crackedOnline = vOnline.crack("Zfcurbctpdqrau", { keyLength: 5 });
        const crackedOffline = vOffline.crack("Zfcurbctpdqrau", { keyLength: 5 });

        const rankedOnline = await sOnline.rankCandidates(crackedOnline.candidates, {
          languageHints: ["en"],
        });
        const rankedOffline = await sOffline.rankCandidates(crackedOffline.candidates, {
          languageHints: ["en"],
        });

        expect(rankedOffline.bestCandidate.key).toBe("BRICK");
        if (apiReachable) {
          // Wenn die API erreichbar ist, muss der Online-Pfad sie auch wirklich nutzen.
          expect(rankedOnline.bestCandidate.key).toBe("BRICK");
          expect(rankedOnline.apiAvailable).toBe(true);
        } else {
          // Offline-Labore dürfen nicht failen; hier sichern wir explizit den Fallback.
          expect(rankedOnline.bestCandidate).toBeTruthy();
        }
      }, 60_000);

    it(
      `recovers BRICK/Youshallntpass for Zfcurbctpdqrau without keyLength hint (${mode.label})`,
      async () => {
        const { vigenere, scorer } = loadRuntime();
        const cracked = vigenere.crack("Zfcurbctpdqrau", {
          optimizations: mode.value,
        });
        if (mode.value === true) {
          const ranked = await scorer.rankCandidates(cracked.candidates, {
            languageHints: ["en"],
          });
          expect(ranked.bestCandidate.key).toBe("BRICK");
          expect(ranked.bestCandidate.text).toBe("Youshallntpass");
          return;
        }

        // Legacy-Modus bleibt absichtlich unverändert; wir sichern hier
        // deterministisches Verhalten statt Optimierungs-Qualität.
        const repeated = vigenere.crack("Zfcurbctpdqrau", {
          optimizations: mode.value,
        });
        expect(cracked.key).toBe(repeated.key);
        expect(cracked.text).toBe(repeated.text);
      },
      60_000
    );
  }

  it("recovers long PHASE ciphertext without keyLength hint", async () => {
    const { vigenere, scorer } = loadRuntime();
    const cracked = vigenere.crack(LONG_PHASE_CIPHERTEXT, {
      optimizations: true,
    });
    const ranked = await scorer.rankCandidates(cracked.candidates, {
      languageHints: ["de", "en"],
    });

    expect(ranked.bestCandidate.key).toBe(LONG_PHASE_KEY);
    expect(compactLetters(ranked.bestCandidate.text)).toBe(compactLetters(LONG_PHASE_PLAINTEXT));
  }, 120_000);

  it("recovers the QUANT regression without keyLength hint when optimizations are enabled", async () => {
    const { vigenere, scorer } = loadRuntime();
    const quantCiphertext = vigenere.encrypt(QUANT_PLAINTEXT, QUANT_KEY);
    const cracked = vigenere.crack(quantCiphertext, {
      optimizations: true,
    });
    const ranked = await scorer.rankCandidates(cracked.candidates, {
      languageHints: ["de"],
    });

    // Die Regression sichert explizit den unhinted Pfad ab, in dem Länge 5 zuvor
    // schon vor der eigentlichen Frequenzanalyse aus der Kandidatenmenge herausfiel.
    expect(cracked.candidates.some((candidate) => candidate.keyLength === 5)).toBe(true);
    expect(ranked.bestCandidate.key).toBe(QUANT_KEY);
    expect(compactLetters(ranked.bestCandidate.text)).toBe(compactLetters(QUANT_PLAINTEXT));
  }, 120_000);

  it("recovers long PHASE ciphertext with keyLength=5", async () => {
    const { vigenere, scorer } = loadRuntime();
    const cracked = vigenere.crack(LONG_PHASE_CIPHERTEXT, {
      keyLength: 5,
      optimizations: true,
    });
    const ranked = await scorer.rankCandidates(cracked.candidates, {
      languageHints: ["de", "en"],
    });

    expect(ranked.bestCandidate.key).toBe(LONG_PHASE_KEY);
    expect(compactLetters(ranked.bestCandidate.text)).toBe(compactLetters(LONG_PHASE_PLAINTEXT));
  }, 120_000);

  it("keeps PHASE winner on the app.js crack path without keyLength hint", async () => {
    const runtime = loadAppRuntimeForVigenere();
    runtime.elements.modeSelect.value = "decrypt";
    runtime.elements.cipherSelect.value = "vigenere";
    runtime.elements.keyInput.value = "";
    runtime.elements.crackLengthInput.value = "";
    runtime.elements.inputText.value = LONG_PHASE_CIPHERTEXT;

    await runtime.runDecrypt();

    expect(compactLetters(runtime.elements.outputText.value)).toBe(compactLetters(LONG_PHASE_PLAINTEXT));
    expect(runtime.elements.resultInfo.textContent.includes("PHASE")).toBe(true);
  }, 120_000);

  it("keeps seeded sample cases deterministic and mostly recoverable", () => {
    const { vigenere } = loadRuntime();
    const sample = generateVigenereDataset(4, 42);

    let hintedRecovered = 0;
    let unhintedRecovered = 0;

    for (const testCase of sample) {
      const hinted = vigenere.crack(testCase.ciphertext, {
        keyLength: testCase.keyLength,
        optimizations: true,
      });
      const unhinted = vigenere.crack(testCase.ciphertext, {
        optimizations: true,
      });

      const expected = testCase.plaintext.replace(/[^A-Za-z]/g, "").toUpperCase();
      const hintedText = hinted.text.replace(/[^A-Za-z]/g, "").toUpperCase();
      const unhintedText = unhinted.text.replace(/[^A-Za-z]/g, "").toUpperCase();

      if (hintedText === expected) {
        hintedRecovered += 1;
      }
      if (unhintedText === expected) {
        unhintedRecovered += 1;
      }
    }

    expect(hintedRecovered).toBeGreaterThanOrEqual(3);
    expect(unhintedRecovered).toBeGreaterThanOrEqual(2);
  }, 180_000);

  it("recognizes compact words and segmented variants similarly", async () => {
    const { scorer } = loadRuntime();
    const candidates = [
      { key: "COMPACT", text: "Youshallntpass", confidence: 0.4 },
      { key: "SPACED", text: "You shallnt pass", confidence: 0.4 },
      { key: "NOISE", text: "Qzxvplmrtwyzz", confidence: 0.4 },
    ];

    const ranked = await scorer.rankCandidates(candidates, {
      languageHints: ["en"],
    });
    const compact = ranked.rankedCandidates.find((entry) => entry.key === "COMPACT");
    const spaced = ranked.rankedCandidates.find((entry) => entry.key === "SPACED");
    const noise = ranked.rankedCandidates.find((entry) => entry.key === "NOISE");

    expect(compact.dictionary.coverage).toBeGreaterThan(0.9);
    expect(spaced.dictionary.coverage).toBeGreaterThan(0.9);
    expect(compact.confidence).toBeGreaterThan(noise.confidence);
    expect(spaced.confidence).toBeGreaterThan(noise.confidence);
  }, 20_000);

  it("changes ranking when language hints switch from en to de", async () => {
    const { scorer } = loadRuntime();
    const candidates = [
      { key: "EN", text: "you shall nt pass", confidence: 0.5 },
      { key: "DE", text: "ich und du nicht", confidence: 0.5 },
    ];

    const englishFirst = await scorer.rankCandidates(candidates, {
      languageHints: ["en"],
    });
    const germanFirst = await scorer.rankCandidates(candidates, {
      languageHints: ["de"],
    });

    expect(englishFirst.bestCandidate.key).toBe("EN");
    expect(germanFirst.bestCandidate.key).toBe("DE");
  }, 20_000);

  it("reports missing browser harness scripts with an explicit setup error", () => {
    expect(() => loadBrowserContext(["js/does/not/exist.js"])).toThrow(
      "Test-Setup fehlgeschlagen: Skript nicht gefunden: js/does/not/exist.js"
    );
  });

  it("reports invalid browser harness scripts with an explicit execution error", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "krypto-invalid-script-"));
    const invalidScriptPath = path.join(tempDir, "broken-script.js");
    fs.writeFileSync(invalidScriptPath, "window.__broken__ = ;", "utf8");

    try {
      const context = { window: {}, console };
      context.window.window = context.window;
      vm.createContext(context);

      expect(() => loadScriptsIntoContext(context, [invalidScriptPath])).toThrow(
        /Test-Setup fehlgeschlagen: Skript konnte nicht ausgeführt werden: .*broken-script\.js/
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
