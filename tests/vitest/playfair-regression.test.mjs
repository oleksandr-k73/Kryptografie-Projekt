import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

let runtimeCache = null;

function loadRuntime() {
  if (runtimeCache) {
    return runtimeCache;
  }

  const window = loadBrowserContext([
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
    "js/ciphers/playfairCipher.js",
  ]);
  runtimeCache = {
    playfair: window.KryptoCiphers.playfairCipher,
    scorer: window.KryptoCore.dictionaryScorer,
  };
  return runtimeCache;
}

function loadFreshRuntime() {
  const window = loadBrowserContext([
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
    "js/ciphers/playfairCipher.js",
  ]);
  return {
    playfair: window.KryptoCiphers.playfairCipher,
    scorer: window.KryptoCore.dictionaryScorer,
  };
}

function compactLetters(text) {
  return String(text || "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
}

describe("playfair regression", () => {
  it("exposes dictionaryScorer.segmentText contract with stable fields", () => {
    const { scorer } = loadRuntime();
    const segmented = scorer.segmentText("ABITURAUFGABETRAINING", {
      languageHints: ["de", "en"],
      maxWordLength: 40,
    });

    expect(segmented.text).toBe("ABITUR AUFGABE TRAINING");
    expect(segmented.tokens).toEqual(["ABITUR", "AUFGABE", "TRAINING"]);
    expect(segmented.coverage).toBeGreaterThan(0.9);
    expect(segmented.meaningfulTokenRatio).toBeGreaterThan(0.9);
    expect(segmented.unknownRatio).toBeLessThan(0.1);
    expect(segmented.confidence).toBeGreaterThan(0.9);
  });

  it("roundtrip keeps didactic normalization rules stable", () => {
    const { playfair } = loadRuntime();
    const plaintext = "Balloon Jolly";
    const encrypted = playfair.encrypt(plaintext, "QUANT");
    const decrypted = playfair.decrypt(encrypted, "QUANT");

    expect(encrypted).toMatch(/^[A-Z]+$/);
    // J -> I und X-Filler-Entfernung müssen im Roundtrip konsistent bleiben.
    expect(compactLetters(decrypted)).toBe("BALLOONIOLLY");
  });

  it("decrypts mandatory reference ciphertext into readable plaintext", () => {
    const { playfair } = loadRuntime();
    const decrypted = playfair.decrypt("YBSMHOPNKELNFNDKHFKCAY", "QUANT");

    expect(decrypted).toBe("VERSCHRAENKTE TEILCHEN");
  });

  it("keeps the documented FOTONEN FELD decrypt case readable", () => {
    const { playfair } = loadRuntime();

    // Der Klartext muss schon im Decrypt-Pfad lesbar bleiben, damit Crack-Ranking und UI-Ausgabe denselben Zieltext sehen.
    expect(playfair.decrypt("CSUSEKTEFKIA", "QUANT")).toBe("FOTONEN FELD");
  });

  it("decrypts the new mandatory QUANT reference case into readable plaintext", () => {
    const { playfair } = loadRuntime();

    expect(playfair.decrypt("GPOASZATEFEKMKKD", "QUANT")).toBe("IMPULS UND ENERGIE");
  });

  it("crack is deterministic for mandatory reference case", () => {
    const { playfair, scorer } = loadRuntime();
    const keyCandidates = scorer.getKeyCandidates({
      languageHints: ["de", "en"],
      limit: 260,
    });

    const first = playfair.crack("YBSMHOPNKELNFNDKHFKCAY", { keyCandidates });
    const second = playfair.crack("YBSMHOPNKELNFNDKHFKCAY", { keyCandidates });

    expect(first.key).toBe("QUANT");
    expect(first.text).toBe("VERSCHRAENKTE TEILCHEN");
    expect(first.search.fallbackTriggered).toBe(false);
    expect(second.key).toBe(first.key);
    expect(second.text).toBe(first.text);
    expect(second.confidence).toBeCloseTo(first.confidence, 10);
  });

  it("keeps the documented FOTONEN FELD crack case in phase A", () => {
    const { playfair, scorer } = loadRuntime();
    const keyCandidates = scorer.getKeyCandidates({
      languageHints: ["de", "en"],
      limit: 320,
    });

    const cracked = playfair.crack("CSUSEKTEFKIA", { keyCandidates });

    expect(cracked.key).toBe("QUANT");
    expect(cracked.text).toBe("FOTONEN FELD");
    expect(cracked.search.phase).toBe("A");
    expect(cracked.search.fallbackTriggered).toBe(false);
  });

  it("keeps the documented FOTONEN SIGNAL crack case readable", () => {
    const { playfair, scorer } = loadRuntime();
    const keyCandidates = scorer.getKeyCandidates({
      languageHints: ["de", "en"],
      limit: 320,
    });

    // Der zweite Belegfall schützt dieselbe Bugklasse, damit der Fix nicht nur auf ein Einzelwort optimiert bleibt.
    const cracked = playfair.crack("CSUSEKTRKHTNIZ", { keyCandidates });

    expect(cracked.key).toBe("QUANT");
    expect(cracked.text).toBe("FOTONEN SIGNAL");
    expect(cracked.search.phase).toBe("A");
    expect(cracked.search.fallbackTriggered).toBe(false);
  });

  it("keeps the new IMPULS UND ENERGIE crack case in phase A", () => {
    const { playfair, scorer } = loadRuntime();
    const keyCandidates = scorer.getKeyCandidates({
      languageHints: ["de", "en"],
      limit: 320,
    });

    const cracked = playfair.crack("GPOASZATEFEKMKKD", { keyCandidates });

    expect(cracked.key).toBe("QUANT");
    expect(cracked.text).toBe("IMPULS UND ENERGIE");
    expect(cracked.search.phase).toBe("A");
    expect(cracked.search.fallbackTriggered).toBe(false);
  });

  it("cracks the FAC keyless regression case in phase A", () => {
    const { playfair, scorer } = loadRuntime();
    const ciphertext = "FBPBKLMFVBBGTAOYQIDQPHYOPOKGQGHBGNQTRXGKQISW";
    const keyCandidates = scorer.getKeyCandidates({
      languageHints: ["de", "en"],
      text: ciphertext,
      minLength: 3,
      maxLength: 8,
      limit: 260,
    });

    const cracked = playfair.crack(ciphertext, { keyCandidates });
    const expected = playfair.decrypt(ciphertext, "FAC");

    // Der Regressionstest stellt sicher, dass FAC im Keyless-Pfad erreichbar bleibt.
    expect(cracked.key).toBe("FAC");
    expect(cracked.text).toBe(expected);
    expect(cracked.search.phase).toBe("A");
  });

  it("segments hybrid OOV and lexicon cases correctly", () => {
    const { scorer } = loadRuntime();

    // Der Default bleibt konservativ: Bei unsicheren Boundaries darf die Rohform stehen bleiben.
    // Gleichzeitig müssen klare Segmentfälle weiterhin zuverlässig getrennt werden.
    expect(scorer.segmentText("IMPULSUNDENERGIE").text).toBe("IMPULS UND ENERGIE");
    expect(scorer.segmentText("FOTONENFELD").text).toBe("FOTONENFELD");
    expect(scorer.segmentText("FOTONENSIGNAL").text).toBe("FOTONEN SIGNAL");
    expect(scorer.segmentText("KOHARENZFELD").text).toBe("KOHARENZ FELD");
  });

  it("segments new skytale-related compounds correctly", () => {
    const { scorer } = loadRuntime();

    // Die Segmentierung darf nur Leerzeichen ergänzen, ohne den Wortlaut zu verändern.
    expect(scorer.segmentText("PHOTOEFFEKTDATEN").text).toBe("PHOTOEFFEKT DATEN");
    expect(scorer.segmentText("MESSREIHEMITFEHLER").text).toBe("MESSREIHE MIT FEHLER");
    expect(scorer.segmentText("UNSCHAERFEIMORT").text).toBe("UNSCHAERFE IM ORT");
    expect(scorer.segmentText("DCODEPLAYFAIRBITTEFUNKTIONIEREICHMUSSWEITER").text).toBe(
      "DCODE PLAYFAIR BITTE FUNKTIONIERE ICH MUSS WEITER"
    );
  });

  it("keeps weak-boundary compounds unsplit", () => {
    const { scorer } = loadRuntime();

    // Bei unklaren Boundaries bleibt die Rohform sichtbar, damit Over-Splitting
    // keine spekulativen Leerzeichen in die UI drückt.
    expect(scorer.segmentText("MACHZEHNDERSIGNAL").text).toBe("MACHZEHNDERSIGNAL");
    expect(scorer.segmentText("PHASENVERSCHIEBUNG").text).toBe("PHASENVERSCHIEBUNG");
  });

  it("does not overvalue isolated short bridge words inside gibberish", () => {
    const { scorer } = loadRuntime();
    const bad = scorer.segmentText("CUDTUYTRCERELIHR");
    const good = scorer.segmentText("IMPULSUNDENERGIE");

    // IHR darf ohne tragfähige Nachbarsegmente nicht mehr denselben Sinnhaftigkeitshebel auslösen wie ein echter Klartext.
    expect(bad.text.includes("IHR")).toBe(true);
    expect(bad.meaningfulTokenRatio).toBeLessThan(good.meaningfulTokenRatio);
    expect(bad.confidence).toBeLessThan(good.confidence);
    expect(bad.unknownRatio).toBeGreaterThan(good.unknownRatio);
  });

  it("segments report case 1 correctly: BERECHNE DIE WELLE", () => {
    const { playfair, scorer } = loadRuntime();
    const keyCandidates = scorer.getKeyCandidates({
      languageHints: ["de", "en"],
      limit: 320,
    });

    const cracked = playfair.crack("CFYKHOEKIPCYFKKF", { keyCandidates });
    expect(cracked.key).toBe("QUANT");
    expect(cracked.text).toBe("BERECHNE DIE WELLE");
    expect(cracked.candidates[0].text).toBe("BERECHNE DIE WELLE");
  });

  it("segments report case 2 correctly and ranks QUANT above wrong keys", () => {
    const { playfair, scorer } = loadRuntime();
    const keyCandidates = scorer.getKeyCandidates({
      languageHints: ["de", "en"],
      limit: 320,
    });

    const cracked = playfair.crack("QDLANONABLQDFNPNKAKAIV", { keyCandidates });
    expect(cracked.key).toBe("QUANT");
    expect(cracked.text).toBe("ABITUR AUFGABE TRAINING");
    expect(cracked.candidates[0].key).toBe("QUANT");
    expect(cracked.candidates[0].confidence).toBeGreaterThan(cracked.candidates[1].confidence);
  });

  it("keeps MACHZEHNDERSIGNAL regression case stable for decrypt and crack", () => {
    const { playfair, scorer } = loadRuntime();
    const keyCandidates = scorer.getKeyCandidates({
      languageHints: ["de", "en"],
      limit: 320,
    });

    const decrypted = playfair.decrypt("PQHOYFKUEFSMKHTNIZ", "QUANT");
    const cracked = playfair.crack("PQHOYFKUEFSMKHTNIZ", { keyCandidates });

    expect(compactLetters(decrypted)).toBe("MACHZEHNDERSIGNAL");
    expect(decrypted).toBe("MACHZEHNDERSIGNAL");
    expect(cracked.key).toBe("QUANT");
    expect(compactLetters(cracked.text)).toBe("MACHZEHNDERSIGNAL");
    expect(cracked.text).toBe("MACHZEHNDERSIGNAL");
  });

  it("ambiguity gate triggers fallback phase with default thresholds", () => {
    const { playfair, scorer } = loadRuntime();
    const plaintext = "SICHERHEIT NACHRICHT";
    const cipherText = playfair.encrypt(plaintext, "SICHERHEIT");

    const cracked = playfair.crack(cipherText, {
      keyCandidates: scorer.getKeyCandidates({ languageHints: ["de"], limit: 320 }),
    });

    // Der Test schützt den Pflichtpfad: Bei ambigen Topwerten muss Phase B greifen.
    expect(cracked.search.fallbackTriggered).toBe(true);
    expect(cracked.search.phase).toBe("B");
    expect(cracked.search.fallbackReasons.length).toBeGreaterThan(0);
    expect(compactLetters(cracked.text)).toBe("SICHERHEITNACHRICHT");
  });

  it("reuses phase A scoring during fallback instead of rescoring the same keys", () => {
    const { playfair, scorer } = loadFreshRuntime();
    const plaintext = "SICHERHEIT NACHRICHT";
    const cipherText = playfair.encrypt(plaintext, "SICHERHEIT");
    const keyCandidates = scorer.getKeyCandidates({ languageHints: ["de"], limit: 320 });

    let analyzeCalls = 0;
    const originalAnalyzeTextQuality = scorer.analyzeTextQuality;
    scorer.analyzeTextQuality = function (...args) {
      analyzeCalls += 1;
      return originalAnalyzeTextQuality.apply(this, args);
    };

    // Die finale Anzeige nutzt denselben Segmentpfad wie der Crack-Gewinner; diese
    // Zusatzaufrufe werden separat gemessen, damit nur redundante Key-Bewertungen sichtbar bleiben.
    const displayCalls = (() => {
      analyzeCalls = 0;
      playfair.decrypt(cipherText, "SICHERHEIT");
      return analyzeCalls;
    })();

    analyzeCalls = 0;
    const cracked = playfair.crack(cipherText, { keyCandidates });

    expect(cracked.search.phase).toBe("B");
    expect(cracked.search.phaseBKeyCount).toBeGreaterThan(0);
    expect(analyzeCalls).toBeLessThanOrEqual(cracked.search.phaseBKeyCount + displayCalls);
    expect(compactLetters(cracked.text)).toBe("SICHERHEITNACHRICHT");
  });

  it(
    "fallback fixture reaches at least 0.80 deterministic success rate",
    () => {
      const { playfair, scorer } = loadRuntime();
      const fixture = [
        { key: "PAYLOAD", text: "NACHRICHT PAYLOAD" },
        { key: "CONTENT", text: "CONTENT MESSAGE" },
        { key: "MESSAGE", text: "SIGNAL MESSAGE" },
        { key: "SIGNAL", text: "SIGNAL TEXT" },
        { key: "QUANTEN", text: "QUANTEN TEILCHEN" },
        { key: "TEILCHEN", text: "VERSCHRAENKTE TEILCHEN" },
        { key: "NACHRICHT", text: "NACHRICHT SICHERHEIT" },
        { key: "SICHERHEIT", text: "SICHERHEIT ANALYSE" },
        { key: "ANALYSE", text: "ANALYSE KRYPTO" },
        { key: "METHODIK", text: "METHODIK STRUKTUR" },
      ];

      const keyCandidates = scorer.getKeyCandidates({
        languageHints: ["de", "en"],
        limit: 360,
      });

      let hits = 0;
      for (const entry of fixture) {
        const cipherText = playfair.encrypt(entry.text, entry.key);
        const cracked = playfair.crack(cipherText, { keyCandidates });
        const expected = compactLetters(playfair.decrypt(cipherText, entry.key));
        const actual = compactLetters(cracked.text);
        if (actual === expected) {
          hits += 1;
        }
      }

      const successRate = hits / fixture.length;
      expect(successRate).toBeGreaterThanOrEqual(0.8);
    },
    // Der Fixture-Lauf prüft nur Erfolgsquote, nicht Laufzeit; mit großem Offline-Lexikon braucht der reine Qualitätscheck mehr Puffer als der Default.
    30_000
  );
});
