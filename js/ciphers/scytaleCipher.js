(function initScytaleCipher(global) {
  const root = global.KryptoCiphers || (global.KryptoCiphers = {});

  const COMMON_BIGRAMS = new Set([
    "er",
    "en",
    "ch",
    "st",
    "nd",
    "ie",
    "ei",
    "de",
    "te",
    "ge",
    "qu",
    "th",
    "he",
    "in",
    "an",
    "re",
  ]);
  const COMMON_TRIGRAMS = new Set([
    "der",
    "die",
    "und",
    "ein",
    "sch",
    "ich",
    "ist",
    "das",
    "the",
    "and",
    "ing",
    "ion",
    "ent",
    "ung",
    "ten",
    "ter",
    "ell",
  ]);
  const DOMAIN_WORDS = [
    "abitur",
    "aufgabe",
    "training",
    "berechne",
    "welle",
    "signal",
    "impuls",
    "energie",
    "quanten",
    "teilchen",
    "feld",
    "modell",
    "analyse",
    "richtung",
    "struktur",
    "nachricht",
    "laser",
    "trifft",
    "gitter",
    "photoeffekt",
    "messreihe",
    "unschaerfe",
    "fehler",
    "daten",
    "dcode",
    "playfair",
    "funktioniere",
    "bitte",
    "weiter",
    "ich",
    "muss",
    "ort",
  ];

  function normalizeBase(input) {
    return String(input || "")
      .replace(/Ä/g, "AE")
      .replace(/Ö/g, "OE")
      .replace(/Ü/g, "UE")
      .replace(/ä/g, "AE")
      .replace(/ö/g, "OE")
      .replace(/ü/g, "UE")
      .replace(/ß/g, "SS")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
  }

  function toSkytaleAZ(text) {
    return normalizeBase(text).replace(/[^A-Z]/g, "");
  }

  function padToMultiple(text, key) {
    const remainder = text.length % key;
    if (remainder === 0) {
      return text;
    }
    // Padding stabilisiert die Raster-Geometrie, damit Verschlüsselung und Inversion exakt bleiben.
    return text + "X".repeat(key - remainder);
  }

  function encryptSkytale(text, key) {
    const normalized = padToMultiple(toSkytaleAZ(text), key);
    if (!normalized) {
      return "";
    }

    const rows = normalized.length / key;
    const columns = Array.from({ length: key }, () => []);
    let index = 0;

    // Skytale-Konvention: Spalten werden gefüllt, Zeilen gelesen.
    for (let col = 0; col < key; col += 1) {
      for (let row = 0; row < rows; row += 1) {
        columns[col][row] = normalized[index] || "X";
        index += 1;
      }
    }

    let output = "";
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < key; col += 1) {
        output += columns[col][row] || "X";
      }
    }

    return output;
  }

  function decryptSkytale(text, key) {
    const normalized = padToMultiple(toSkytaleAZ(text), key);
    if (!normalized) {
      return "";
    }

    const rows = normalized.length / key;
    const grid = Array.from({ length: rows }, () => Array(key).fill("X"));
    let index = 0;

    // Inversion: Zeilen füllen, danach wieder Spalten lesen.
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < key; col += 1) {
        grid[row][col] = normalized[index] || "X";
        index += 1;
      }
    }

    let output = "";
    for (let col = 0; col < key; col += 1) {
      for (let row = 0; row < rows; row += 1) {
        output += grid[row][col] || "X";
      }
    }

    return output;
  }

  function getDictionaryScorer() {
    const core = global.KryptoCore;
    return core && core.dictionaryScorer ? core.dictionaryScorer : null;
  }

  function fallbackScore(text) {
    const lower = String(text || "").toLowerCase();
    let score = 0;

    for (let index = 0; index < lower.length - 1; index += 1) {
      if (COMMON_BIGRAMS.has(lower.slice(index, index + 2))) {
        score += 0.25;
      }
    }

    for (let index = 0; index < lower.length - 2; index += 1) {
      if (COMMON_TRIGRAMS.has(lower.slice(index, index + 3))) {
        score += 0.55;
      }
    }

    return score;
  }

  function countWordHits(text, word) {
    let count = 0;
    let index = 0;
    while (index >= 0) {
      index = text.indexOf(word, index);
      if (index === -1) {
        break;
      }
      count += 1;
      index += word.length;
    }
    return count;
  }

  function computeDomainBonus(text) {
    const lower = String(text || "").toLowerCase();
    let bonus = 0;

    for (const word of DOMAIN_WORDS) {
      const hits = countWordHits(lower, word);
      if (hits === 0) {
        continue;
      }
      // Kürzere Fachwörter bekommen einen kleineren Bonus, damit Zufallstreffer nicht dominieren.
      const weight = word.length >= 8 ? 3.2 : word.length >= 6 ? 2.2 : word.length >= 4 ? 1.2 : 0.4;
      bonus += hits * weight;
    }

    return bonus;
  }

  function analyzeCandidateText(rawText) {
    const scorer = getDictionaryScorer();
    // Padding-X am Ende verzerren sonst das Sprach-Scoring und drücken korrekte Keys nach unten.
    const scoringText = rawText.replace(/X+$/, "") || rawText;
    const result = {
      text: rawText,
      rawText,
      confidence: fallbackScore(rawText),
    };

    if (!scorer || typeof scorer.analyzeTextQuality !== "function") {
      return result;
    }

    try {
      let analysis = scorer.analyzeTextQuality(scoringText, {
        languageHints: ["de", "en"],
        maxWordLength: 40,
      });
      const initialDisplayText =
        analysis && typeof analysis.displayText === "string"
          ? analysis.displayText.trim()
          : scoringText;
      if (
        analysis &&
        Number(analysis.coverage) < 0.2 &&
        initialDisplayText &&
        initialDisplayText !== scoringText &&
        /\s/.test(initialDisplayText)
      ) {
        // Wenn die Anzeige-Token deutlich besser segmentieren, nutzen wir sie fürs Scoring nach.
        analysis = scorer.analyzeTextQuality(initialDisplayText, {
          languageHints: ["de", "en"],
          maxWordLength: 40,
        });
      }
      const qualityScore = Number(analysis && analysis.qualityScore) || 0;
      const coverage = Number(analysis && analysis.coverage) || 0;
      const meaningfulTokenRatio = Number(analysis && analysis.meaningfulTokenRatio) || 0;
      // Interne X-Häufungen deuten auf falsche Raster auf; Padding-X sitzen bei korrekten Keys am Ende.
      const internalXCount = (scoringText.match(/X/g) || []).length;
      const internalXPenalty = (internalXCount / Math.max(1, rawText.length)) * 12;
      const domainBonus = computeDomainBonus(scoringText);
      const confidence =
        qualityScore +
        coverage * 10 +
        meaningfulTokenRatio * 8 -
        internalXPenalty +
        domainBonus;
      const displayText =
        analysis && typeof analysis.displayText === "string"
          ? analysis.displayText.trim()
          : initialDisplayText;

      // Crack-Score und Ausgabe sollen dieselbe Segmentierung nutzen, ohne Padding zu verlieren.
      result.text = displayText || scoringText;
      result.rawText = rawText;
      result.confidence = confidence;
    } catch (_error) {
      // Optionales Scoring darf isolierte Umgebungen nicht blockieren.
    }

    return result;
  }

  function buildCandidates(text, keysToTest) {
    const candidates = [];

    for (const key of keysToTest) {
      const rawText = decryptSkytale(text, key);
      const scored = analyzeCandidateText(rawText);
      candidates.push({
        key,
        text: scored.text,
        rawText: scored.rawText,
        confidence: scored.confidence,
      });
    }

    candidates.sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      return a.key - b.key;
    });

    return candidates;
  }

  root.scytaleCipher = {
    id: "scytale",
    name: "Skytale",
    supportsKey: true,
    supportsCrackLengthHint: true,
    reuseKeyForCrackHint: true,
    keyLabel: "Umfang",
    keyPlaceholder: "z. B. 4",
    crackLengthLabel: "Umfang",
    crackLengthPlaceholder: "z. B. 4",
    info: {
      purpose:
        "Transpositionsverfahren mit Zylinderumfang: Text wird in ein Raster geschrieben und zeilenweise gelesen.",
      process:
        "Die Eingabe wird auf A-Z normalisiert, mit X aufgefüllt, spaltenweise geschrieben und anschließend zeilenweise ausgelesen.",
      crack:
        "Ohne Umfang testet das Programm mehrere Rasterbreiten und bewertet die Klartexte mit Sprach-Scoring.",
      useCase:
        "Geeignet für klassische Übungen, bei denen eine klare Transposition ohne Zusatzsymbole gefordert ist.",
    },

    parseKey(rawKey) {
      const key = Number.parseInt(rawKey, 10);
      if (!/^\d+$/.test(String(rawKey || "").trim()) || Number.isNaN(key)) {
        throw new Error("Der Umfang muss als ganze Zahl angegeben werden.");
      }
      if (key < 2) {
        throw new Error("Der Umfang muss mindestens 2 sein.");
      }
      return key;
    },

    encrypt(text, key) {
      const circumference = this.parseKey(key);
      return encryptSkytale(text, circumference);
    },

    decrypt(text, key) {
      const circumference = this.parseKey(key);
      // decrypt() liefert die rohe Inversion inklusive Padding, damit Lernfälle exakt reproduzierbar bleiben.
      return decryptSkytale(text, circumference);
    },

    crack(text, options) {
      const source = toSkytaleAZ(text);
      const maxKey = Math.min(12, Math.max(2, source.length));

      if (source.length <= 1) {
        return {
          key: 2,
          text: source,
          rawText: source,
          confidence: fallbackScore(source),
          candidates: [
            {
              key: 2,
              text: source,
              rawText: source,
              confidence: fallbackScore(source),
            },
          ],
        };
      }

      let keysToTest = [];
      if (Number.isFinite(options && options.keyLength)) {
        const hinted = Math.max(2, Math.min(maxKey, Math.floor(options.keyLength)));
        keysToTest = [hinted];
      } else {
        for (let key = 2; key <= maxKey; key += 1) {
          keysToTest.push(key);
        }
      }

      const candidates = buildCandidates(source, keysToTest);
      const best = candidates[0];

      return {
        key: best ? best.key : 2,
        text: best ? best.text : source,
        rawText: best ? best.rawText : source,
        confidence: best ? best.confidence : fallbackScore(source),
        candidates: candidates.slice(0, 8),
      };
    },
  };
})(window);
