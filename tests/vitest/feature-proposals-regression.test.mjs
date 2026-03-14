import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadBrowserContext } from "./_browserHarness.mjs";

const THIS_FILE = fileURLToPath(import.meta.url);
const THIS_DIR = path.dirname(THIS_FILE);
const ROOT_DIR = path.resolve(THIS_DIR, "../..");

function loadRuntime(fetchImpl) {
  const window = loadBrowserContext(
    ["js/ciphers/vigenereCipher.js", "js/core/segmentLexiconData.js", "js/core/dictionaryScorer.js"],
    { fetchImpl }
  );
  return {
    vigenere: window.KryptoCiphers.vigenereCipher,
    scorer: window.KryptoCore.dictionaryScorer,
  };
}

function loadVigenereVmContext(fetchImpl) {
  const context = {
    window: {},
    console,
    fetch: fetchImpl,
    AbortController,
    setTimeout,
    clearTimeout,
  };
  context.window.window = context.window;
  vm.createContext(context);
  const source = fs.readFileSync(path.resolve(ROOT_DIR, "js/ciphers/vigenereCipher.js"), "utf8");
  vm.runInContext(source, context, {
    filename: path.resolve(ROOT_DIR, "js/ciphers/vigenereCipher.js"),
  });
  return context;
}

function loadFileParser() {
  const window = loadBrowserContext(["js/core/fileParsers.js"]);
  return window.KryptoCore.parseInputFile;
}

describe("feature proposals regression checks with markdown references", () => {
  it(
    "docs/SCORING.md + js/ciphers/AGENTS.md: unhinted fallback can run and is limited by adaptive-size gate",
    () => {
      const { vigenere } = loadRuntime(() => Promise.reject(new Error("offline")));
      const text = "OLIXGLUPCHBO";

      const allowed = vigenere.crack(text, {
        optimizations: false,
        bruteforceFallback: { maxTotalMs: 2_000, maxMsPerLength: 800 },
      });
      expect(allowed.search.bruteforceFallbackTriggered).toBe(true);
      expect(allowed.search.bruteforceFallbackReason).toBe("short_text_low_sense_keylength_gate");
      expect(Number.isInteger(allowed.search.bruteforceFallbackKeyLength)).toBe(true);

      // Niedriges maxMsPerLength erzwingt den adaptiven Gate-Pfad ohne KeyLength-Hint.
      const blocked = vigenere.crack(text, {
        optimizations: false,
        bruteforceFallback: { maxTotalMs: 2_000, maxMsPerLength: 1 },
      });
      expect(blocked.search.bruteforceFallbackTriggered).toBe(false);
      expect(blocked.search.bruteforceFallbackReason).toBe("adaptive_size_gate_not_met");
    },
    20_000
  );

  it("docs/SCORING.md: API reachability probes all language hints and not just the first", async () => {
    const requestedUrls = [];
    const fetchMock = async (url) => {
      requestedUrls.push(String(url));
      if (String(url).endsWith("/entries/de/test")) {
        throw new Error("de probe failed");
      }
      if (String(url).endsWith("/entries/en/test")) {
        return { ok: true };
      }
      return { ok: false };
    };
    const { scorer } = loadRuntime(fetchMock);

    const ranked = await scorer.rankCandidates(
      [{ key: "X", text: "qzxv plm", confidence: 0.7 }],
      { languageHints: ["de", "en"] }
    );

    expect(requestedUrls.some((url) => url.includes("/entries/de/test"))).toBe(true);
    expect(requestedUrls.some((url) => url.includes("/entries/en/test"))).toBe(true);
    expect(ranked.apiAvailable).toBe(true);
  });

  it("docs/DATENFLUSS.md: apiAvailable is false when probes/results fail even though fetch exists", async () => {
    const { scorer } = loadRuntime(async () => {
      throw new Error("network unavailable");
    });
    const ranked = await scorer.rankCandidates(
      [{ key: "X", text: "hello world", confidence: 0.7 }],
      { languageHints: ["en"] }
    );
    expect(ranked.apiAvailable).toBe(false);
  });

  it("docs/SCORING.md: API rescoring uses raw confidence and avoids double damping", async () => {
    const fetchMock = async (url) => {
      if (String(url).endsWith("/entries/en/test")) {
        return { ok: true };
      }
      // Alle Wortchecks liefern "invalid", bleiben aber API-seitig erreichbar.
      return { ok: false };
    };
    const { scorer } = loadRuntime(fetchMock);

    const ranked = await scorer.rankCandidates(
      [{ key: "RAW", text: "qzxv plm", confidence: 100 }],
      { languageHints: ["en"] }
    );
    const best = ranked.bestCandidate;

    expect(best.rawConfidence).toBe(100);
    // Bei Double-Damping läge der Score nahe 9; mit Rohscore bleibt er > 25.
    expect(best.confidence).toBeGreaterThan(25);
    expect(best.confidence).toBeLessThan(40);
  });

  it("AGENTS.md + docs/DATENFLUSS.md: fallback status string is defensively formatted in app.js", () => {
    const appSource = fs.readFileSync(path.resolve(ROOT_DIR, "js/app.js"), "utf8");

    expect(appSource.includes("Number.isFinite(search && search.bruteforceFallbackKeyLength)")).toBe(
      true
    );
    expect(appSource.includes("Number.isFinite(search && search.bruteforceCombosVisited)")).toBe(
      true
    );
    expect(appSource.includes("Number.isFinite(search && search.bruteforceElapsedMs)")).toBe(true);
    expect(appSource.includes('fallbackKeyLength == null ? "unbekannt" : fallbackKeyLength')).toBe(
      true
    );
    expect(appSource.includes("Math.max(0, Math.round(search.bruteforceElapsedMs))")).toBe(true);
  });

  it("js/app.js + js/ciphers/railFenceCipher.js: Rail Fence reuses the key field instead of showing a second hint field", () => {
    const appSource = fs.readFileSync(path.resolve(ROOT_DIR, "js/app.js"), "utf8");
    const railFenceSource = fs.readFileSync(
      path.resolve(ROOT_DIR, "js/ciphers/railFenceCipher.js"),
      "utf8"
    );

    // Rail Fence nutzt im Decrypt-Modus dasselbe Feld als Entschlüsselungswert oder als
    // Trigger für den Crack-Pfad; ein zweites UI-Feld würde denselben Hebel doppelt abbilden.
    expect(railFenceSource.includes("reuseKeyForCrackHint: true")).toBe(true);
    expect(appSource.includes("!Boolean(cipher && cipher.reuseKeyForCrackHint)")).toBe(true);
    expect(appSource.includes("cipher.reuseKeyForCrackHint")).toBe(true);
  });

  it(
    "docs/SCORING.md + js/ciphers/AGENTS.md: long hinted text uses chi/frequency path and skips bruteforce",
    () => {
      const { vigenere } = loadRuntime(() => Promise.reject(new Error("offline")));
      const cracked = vigenere.crack(
        "APCZX QYEAXTA SAGW HLK ATSLW EJZ UFH OLIYX XUTWVULRWRO HM VSEWEDWEHLL",
        {
          keyLength: 5,
          optimizations: { memoChi: true, collectStats: true },
          bruteforceFallback: { enabled: true, shortTextMaxLetters: 22 },
        }
      );

      expect(cracked.search.bruteforceFallbackTriggered).toBe(false);
      expect(cracked.search.bruteforceFallbackReason).toBe("text_not_short");
      expect(cracked.search.shortTextRescue).toBe(false);
      expect(cracked.search.statesGenerated).toBeGreaterThan(0);
      expect(cracked.search.telemetry.chiCalls).toBeGreaterThan(0);
    }
  );

  it(
    "docs/SCORING.md: hinted short fallback uses maxMsPerLength directly without adaptive extra cap",
    () => {
      const context = loadVigenereVmContext(() => Promise.reject(new Error("offline")));
      // Deterministische Zeitsteuerung macht das Budgetverhalten reproduzierbar.
      vm.runInContext(
        `
        let __tick = 0;
        Date.now = () => {
          __tick += 350;
          return __tick;
        };
        `,
        context
      );
      const vigenere = context.window.KryptoCiphers.vigenereCipher;
      const cracked = vigenere.crack("SIDR NDX CUBVZRR", {
        keyLength: 5,
        optimizations: true,
        bruteforceFallback: {
          enabled: true,
          maxKeyLength: 6,
          shortTextMaxLetters: 22,
          maxTotalMs: 6_000,
          maxMsPerLength: 6_000,
          stageWidths: [26],
        },
      });

      expect(cracked.search.bruteforceFallbackTriggered).toBe(true);
      expect(cracked.search.bruteforceFallbackReason).toBe("short_text_low_sense_keylength_gate");
      // Ohne Fix wäre hier durch adaptive Zusatzkappung deutlich früher Schluss.
      expect(cracked.search.bruteforceCombosVisited).toBeGreaterThanOrEqual(500);
      expect(cracked.search.bruteforceElapsedMs).toBeGreaterThanOrEqual(2_000);
    },
    30_000
  );

  it(
    "js/ciphers/vigenereCipher.js: chi memo cache stays bounded and reset across sessions",
    () => {
      const { vigenere } = loadRuntime(() => Promise.reject(new Error("offline")));
      const text = "QWERTYUIOPASDFGHJKLZXCVBNM QWERTYUIOPASDFGHJKLZXCVBNM";
      const options = {
        keyLength: 5,
        optimizations: { memoChi: true, collectStats: true },
        bruteforceFallback: { enabled: false },
      };

      const first = vigenere.crack(text, options);
      const second = vigenere.crack(text, options);
      const firstTelemetry = first.search.telemetry;
      const secondTelemetry = second.search.telemetry;

      expect(firstTelemetry.chiMemoMaxSize).toBeGreaterThan(0);
      expect(firstTelemetry.chiMemoMaxSize).toBeLessThanOrEqual(12_000);
      expect(secondTelemetry.chiMemoMisses).toBe(firstTelemetry.chiMemoMisses);
      expect(secondTelemetry.chiMemoHits).toBe(firstTelemetry.chiMemoHits);

      // Ein Zwischenlauf ohne memoChi darf den nächsten memoChi-Lauf nicht beeinflussen.
      vigenere.crack(text, {
        keyLength: 5,
        optimizations: { memoChi: false, collectStats: false },
        bruteforceFallback: { enabled: false },
      });
      const third = vigenere.crack(text, options);
      expect(third.search.telemetry.chiMemoMisses).toBe(firstTelemetry.chiMemoMisses);
    },
    30_000
  );

  it(
    "js/ciphers/vigenereCipher.js: oversized keyLength hint stays clamped in optimization divisor path",
    () => {
      const { vigenere } = loadRuntime(() => Promise.reject(new Error("offline")));
      const cracked = vigenere.crack("ABCD", {
        keyLength: 10,
        optimizations: true,
        candidateBudget: 32,
        stateBudget: 64,
        evaluationBudget: 32,
        bruteforceFallback: { enabled: false },
      });

      const testedLengths = Array.from(new Set(cracked.candidates.map((entry) => entry.keyLength)));
      // Oversized Hints dürfen keine zusätzlichen Suchlängen außerhalb der realen Textlänge öffnen.
      expect(testedLengths.every((length) => length <= 4)).toBe(true);
    },
    15_000
  );

  it(
    "js/ciphers/vigenereCipher.js: fallback hint gating uses clamped length instead of raw oversized hint",
    () => {
      const { vigenere } = loadRuntime(() => Promise.reject(new Error("offline")));
      const cracked = vigenere.crack("OLIX", {
        keyLength: 10,
        optimizations: false,
        candidateBudget: 32,
        stateBudget: 64,
        evaluationBudget: 32,
        bruteforceFallback: {
          enabled: true,
          shortTextMaxLetters: 22,
          maxKeyLength: 6,
          maxTotalMs: 200,
          maxMsPerLength: 200,
          stageWidths: [3],
        },
      });

      // Mit Clamp muss der Fallback für die tatsächlich getestete Länge laufen.
      expect(cracked.search.bruteforceFallbackTriggered).toBe(true);
      expect(cracked.search.bruteforceFallbackReason).toBe("short_text_low_sense_keylength_gate");
      expect(cracked.search.bruteforceFallbackKeyLength).toBe(4);
    },
    15_000
  );

  it("docs/DATENFLUSS.md: headerlose CSV im Fallback verliert keine erste Datenzeile", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "rows.csv",
      text: async () => "alpha,beta\ngamma,delta",
    });
    expect(parsed.text).toBe("alpha beta gamma delta");
  });

  it("js/core/fileParsers.js: JS-Literal-Fallback bekommt keinen künstlichen value-Bonus", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "payload.js",
      text: async () =>
        'const payload = { title: "Release notes preview", cipher: "Zfcurbctpdqrau" };',
    });
    // Der Test sichert, dass echte Key-Signale ("cipher") entscheiden und ein neutraler Fallback
    // Metadaten-Literale nicht mehr durch einen starken "value"-Pfad nach oben zieht.
    expect(parsed.text).toBe("Zfcurbctpdqrau");
  });

  it("js/core/fileParsers.js: doppelt escaptes \\n bleibt als Literal erhalten", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "payload.js",
      text: async () => 'const message = "A\\\\nB";',
    });
    // Der Regressionstest schützt gegen Escape-Overlap: "\\n" steht hier für Backslash+n
    // und darf nicht durch spätere Decoder-Schritte zu einem echten Zeilenumbruch kippen.
    expect(parsed.text).toBe("A\\nB");
  });

  it("js/core/fileParsers.js: doppelt escaptes \\uXXXX bleibt als Literal erhalten", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "payload.js",
      text: async () => 'const message = "\\\\u0041";',
    });
    // Der Test verhindert, dass aus einem bewusst doppelten Escape versehentlich eine
    // echte Unicode-Decodierung wird und damit Nutzdaten semantisch verändert werden.
    expect(parsed.text).toBe("\\u0041");
  });

  it("js/core/fileParsers.js: doppelt escaptes \\xXX bleibt als Literal erhalten", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "payload.js",
      text: async () => 'const message = "\\\\x41";',
    });
    // Hex-Escapes folgen demselben Overlap-Risiko wie Unicode-Escapes und müssen bei
    // doppeltem Escape als Literal stabil bleiben.
    expect(parsed.text).toBe("\\x41");
  });

  it("js/core/fileParsers.js: einfaches \\uXXXX wird weiterhin decodiert", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "payload.js",
      text: async () => 'const message = "\\u0041";',
    });
    // Dieser Positivtest stellt sicher, dass der Fix nur Overlap-Probleme behebt und
    // legitime Single-Escapes weiterhin wie bisher in Klartext überführt.
    expect(parsed.text).toBe("A");
  });

  it("js/core/fileParsers.js: einfaches \\xXX wird weiterhin decodiert", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "payload.js",
      text: async () => 'const message = "\\x41";',
    });
    // Der zweite Positivfall sichert die bestehende Hex-Decodierung ab, damit der Bugfix
    // nicht als Nebenwirkung gültige Literale unbearbeitet durchreicht.
    expect(parsed.text).toBe("A");
  });

  it("js/core/fileParsers.js: einfaches \\' wird weiterhin korrekt decodiert", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "payload.js",
      text: async () => String.raw`const message = "\'";`,
    });
    // Der Positivtest sichert den Apostroph-Pfad ab, damit der Wechsel auf switch-Branching
    // keine semantische Lücke bei klassischen einfachen Escapes hinterlässt.
    expect(parsed.text).toBe("'");
  });

  it('js/core/fileParsers.js: einfaches \\" wird weiterhin korrekt decodiert', async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "payload.js",
      text: async () => String.raw`const message = "\"";`,
    });
    // Dieser Check verhindert, dass der Quote-Escape im Hot-Path verloren geht und dadurch
    // extrahierte Inhalte mit eingebetteten Anführungszeichen falsch normalisiert werden.
    expect(parsed.text).toBe('"');
  });

  it("js/core/fileParsers.js: einfaches \\\\ wird weiterhin korrekt decodiert", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "payload.js",
      text: async () => String.raw`const message = "\\";`,
    });
    // Der Test deckt den Backslash-Escape explizit ab, weil er als Basis für doppelt escapte
    // Sequenzen dient und Regressionen dort besonders schwer auffallen würden.
    expect(parsed.text).toBe("\\");
  });

  it("js/core/fileParsers.js: unbekannte Escapes bleiben wie bisher ohne Backslash erhalten", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "payload.js",
      text: async () => String.raw`const message = "\q";`,
    });
    // Der Decoder verhält sich absichtlich tolerant: unbekannte Escapes werden wie zuvor
    // als nacktes Zeichen übernommen, damit Altbestände keine neue Parser-Fehlermeldung erzeugen.
    expect(parsed.text).toBe("q");
  });

  it("js/core/fileParsers.js: trailing escaped backslashes bleiben stabil und crashen nicht", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "payload.js",
      text: async () => String.raw`const message = "abc\\\\";`,
    });
    // Das Ende-mit-Backslash-Szenario ist ein klassischer Randfall; der Test sichert, dass
    // der Decoder den Tail robust verarbeitet statt im letzten Index-Schritt zu kippen.
    expect(parsed.text).toBe("abc\\\\");
  });

  it("js/core/fileParsers.js: headerlose CSV mit starker Textspalte behält erste Datenzeile", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "rows.csv",
      text: async () => "message,HELLO\nWORLD,SECOND",
    });
    // Der Regressionstest verhindert, dass die erste Datenzeile im Textspalten-Pfad
    // pauschal als Header behandelt und damit stillschweigend verworfen wird.
    expect(parsed.text).toBe("message\nWORLD");
  });

  it("js/core/fileParsers.js: echte Headerzeile wird im Textspalten-Pfad weiterhin verworfen", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "rows.csv",
      text: async () => "message,meta\nHELLO,1\nWORLD,2",
    });
    // Der Positivfall stellt sicher, dass der Fix keine Header-Leaks einführt und
    // CSVs mit klarer Headerstruktur weiter nur Nutzdatenzeilen liefern.
    expect(parsed.text).toBe("HELLO\nWORLD");
  });

  it('js/core/fileParsers.js: CSV-Header "metadata,message" wählt message statt metadata', async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "rows.csv",
      text: async () => "metadata,message\nmeta-1,Zfcurbctpdqrau\nmeta-2,Second line",
    });
    // Exakte Header-Tokens verhindern, dass "metadata" fälschlich über das Teilwort "data"
    // als Textspalte gewertet wird.
    expect(parsed.text).toBe("Zfcurbctpdqrau\nSecond line");
  });

  it('js/core/fileParsers.js: tokenisierte Header wie "cipher_text" bleiben als Textspalte erkennbar', async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "rows.csv",
      text: async () => "id,cipher_text\n1,Zfcurbctpdqrau\n2,APCZXQYEA",
    });
    // Der Positivfall verhindert Regressionen: Delimiter-basierte Tokenisierung muss strukturierte
    // Header weiterhin als starke Textspalte erkennen.
    expect(parsed.text).toBe("Zfcurbctpdqrau\nAPCZXQYEA");
  });

  it("js/core/fileParsers.js: CSV fallback entfernt konservativ erkannte Headerzeile", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "rows.csv",
      text: async () => "name,city\nalice,berlin\nbob,hamburg",
    });
    expect(parsed.text).toBe("alice berlin bob hamburg");
  });

  it("js/core/fileParsers.js: CSV fallback behält ambige erste Zeile ohne starkes Header-Signal", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "rows.csv",
      text: async () => "name,alpha\nbeta,gamma",
    });
    expect(parsed.text).toBe("name alpha beta gamma");
  });

  it("js/core/fileParsers.js: XML strict matching bevorzugt <coded> statt <codedExport>", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "payload.xml",
      text: async () =>
        `<root><codedExport>FALSCH</codedExport><coded id=\"a1\">YBSMHOPNKELNFNDKHFKCAY</coded></root>`,
    });
    // Strict Tag-Matching verhindert, dass Prefix-Tags wie codedExport den Prioritäts-Tag coded kapern.
    expect(parsed.text).toBe("YBSMHOPNKELNFNDKHFKCAY");
  });

  it("js/core/fileParsers.js: XML strict matching greift nicht auf Prefix-Tags zurück", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "payload.xml",
      text: async () =>
        `<root><codedExport>FALSCH</codedExport><payload>RICHTIG</payload></root>`,
    });
    // Ohne exakten coded-Treffer muss der Parser auf den nächsten Prioritäts-Tag fallen.
    expect(parsed.text).toBe("RICHTIG");
  });

  it("js/core/fileParsers.js: XML ohne Prioritäts-Tag fällt auf Tag-Strip zurück", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "payload.xml",
      text: async () => `<root><meta>A</meta><note>B C</note></root>`,
    });
    expect(parsed.text).toBe("A B C");
  });

  it("js/core/fileParsers.js: YAML extrahiert flaches coded-Feld aus .yaml", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "coded_level_06.yaml",
      text: async () => "level: 6\ncoded: PNLFEOETATPMDLTIOOL\nactive: true\n",
    });

    // YAML nutzt bewusst denselben JSON-Extraktionspfad, damit starke Text-Keys
    // wie coded/message/payload formatübergreifend identisch priorisiert werden.
    expect(parsed.text).toBe("PNLFEOETATPMDLTIOOL");
  });

  it("js/core/fileParsers.js: YAML extrahiert verschachteltes coded-Feld aus .yml", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "payload.yml",
      text: async () => "meta:\n  title: Beispiel\npayload:\n  coded: YBSMHOPNKELNFNDKHFKCAY\n",
    });

    expect(parsed.text).toBe("YBSMHOPNKELNFNDKHFKCAY");
  });

  it("js/core/fileParsers.js: YAML erkennt Sequenzen mit - key: value", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "payload.yaml",
      text: async () => "- meta: 1\n- coded: CSUSEKTEFKIA\n",
    });

    expect(parsed.text).toBe("CSUSEKTEFKIA");
  });

  it("js/core/fileParsers.js: YAML block scalar | bleibt mehrzeilig stabil", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "payload.yaml",
      text: async () => "payload:\n  coded: |\n    LINE 1\n    LINE 2\n",
    });

    expect(parsed.text).toBe("LINE 1\nLINE 2");
  });

  it("js/core/fileParsers.js: YAML block scalar > faltet Zeilen zu Text", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "payload.yml",
      text: async () => "payload:\n  message: >\n    POTENTIALTOPF\n    MODELL\n",
    });

    expect(parsed.text).toBe("POTENTIALTOPF MODELL");
  });

  it("js/core/fileParsers.js: YAML entfernt Kommentare nur außerhalb von Quotes", async () => {
    const parseInputFile = loadFileParser();
    const parsed = await parseInputFile({
      name: "payload.yaml",
      text: async () =>
        'payload:\n  coded: "VALUE # stays"\n  hint: plain # remove this comment\n',
    });

    expect(parsed.text).toBe("VALUE # stays");
  });

  it("js/core/fileParsers.js: YAML mit fortgeschrittenem Feature fällt auf Raw-Text zurück", async () => {
    const parseInputFile = loadFileParser();
    const source = "defaults: &base\n  coded: PNLFEOETATPMDLTIOOL\ncopy: *base\n";
    const parsed = await parseInputFile({
      name: "payload.yaml",
      text: async () => source,
    });

    // Bei Anchors/Aliases ist Raw-Text sicherer als eine halbparste Struktur,
    // weil der Subset-Parser diese Semantik absichtlich nicht emuliert.
    expect(parsed.text).toBe(source);
  });
});
