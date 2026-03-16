(function initColumnarTranspositionCipher(global) {
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
    "topf",
    "potential",
  ];
  const ANALYSIS_SHORTLIST_SIZE = 6;

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

  function toColumnarAZ(text) {
    return normalizeBase(text).replace(/[^A-Z]/g, "");
  }

  function padToMultiple(text, columns) {
    const remainder = text.length % columns;
    if (remainder === 0) {
      return text;
    }
    // Padding stabilisiert die Raster-Geometrie, damit jede Spalte dieselbe Länge hat.
    return text + "X".repeat(columns - remainder);
  }

  function parseNumericKey(rawKey) {
    const raw = String(rawKey || "").trim();
    const tokens = raw.match(/\d+/g) || [];
    if (tokens.length < 2) {
      throw new Error("Der Schlüssel muss mindestens zwei Zahlen enthalten.");
    }

    const numbers = tokens.map((token) => Number.parseInt(token, 10));
    const size = numbers.length;
    const seen = new Set();

    for (const number of numbers) {
      if (!Number.isFinite(number) || number < 1 || number > size || seen.has(number)) {
        throw new Error("Schlüssel muss eine Permutation von 1..N sein.");
      }
      seen.add(number);
    }

    return numbers;
  }

  function parseKeywordKey(rawKey) {
    const normalized = normalizeBase(rawKey).replace(/[^A-Z]/g, "");
    if (normalized.length < 2) {
      throw new Error("Schlüsselwort muss mindestens zwei Buchstaben enthalten.");
    }

    const ranked = normalized
      .split("")
      .map((char, index) => ({ char, index }))
      .sort((a, b) => {
        if (a.char === b.char) {
          return a.index - b.index;
        }
        return a.char.localeCompare(b.char);
      });

    // Die sortierte Reihenfolge liefert die Lese-Reihenfolge der Spalten (1-basiert).
    return ranked.map((entry) => entry.index + 1);
  }

  function parseKey(rawKey) {
    const raw = String(rawKey || "").trim();
    if (!raw) {
      throw new Error("Der Schlüssel darf nicht leer sein.");
    }

    if (/^[\d\s,-]+$/.test(raw)) {
      return parseNumericKey(raw);
    }

    return parseKeywordKey(raw);
  }

  function formatKey(order) {
    return order.join("-");
  }

  function encryptColumnar(text, keyOrder) {
    const columns = keyOrder.length;
    const normalized = padToMultiple(toColumnarAZ(text), columns);
    if (!normalized) {
      return "";
    }

    const rows = normalized.length / columns;
    const grid = Array.from({ length: rows }, () => Array(columns).fill("X"));
    let index = 0;

    // Zeilenweise füllen, damit die Spaltenauslese die eigentliche Transposition bildet.
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        grid[row][col] = normalized[index] || "X";
        index += 1;
      }
    }

    let output = "";
    for (const order of keyOrder) {
      const colIndex = order - 1;
      for (let row = 0; row < rows; row += 1) {
        output += grid[row][colIndex] || "X";
      }
    }

    return output;
  }

  function decryptColumnar(text, keyOrder) {
    const columns = keyOrder.length;
    const normalized = padToMultiple(toColumnarAZ(text), columns);
    if (!normalized) {
      return "";
    }

    const rows = normalized.length / columns;
    const grid = Array.from({ length: rows }, () => Array(columns).fill("X"));
    let index = 0;

    // Spalten in Schlüsselreihenfolge füllen, um die Verschlüsselung exakt zu invertieren.
    for (const order of keyOrder) {
      const colIndex = order - 1;
      for (let row = 0; row < rows; row += 1) {
        grid[row][colIndex] = normalized[index] || "X";
        index += 1;
      }
    }

    let output = "";
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        output += grid[row][col] || "X";
      }
    }

    return output;
  }

  function getDictionaryScorer() {
    const core = global.KryptoCore;
    return core && core.dictionaryScorer ? core.dictionaryScorer : null;
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

  function computeInternalXPenalty(rawText) {
    const trimmed = String(rawText || "").replace(/X+$/g, "");
    const internalXCount = (trimmed.match(/X/g) || []).length;
    return (internalXCount / Math.max(1, rawText.length)) * 10;
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

    return score + computeDomainBonus(lower) - computeInternalXPenalty(text);
  }

  function analyzeCandidateText(rawText) {
    const scorer = getDictionaryScorer();
    // Padding-X am Ende verzerren sonst das Sprach-Scoring und drückt korrekte Keys nach unten.
    const scoringText = String(rawText || "").replace(/X+$/g, "") || rawText;
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
      const internalXPenalty = computeInternalXPenalty(scoringText);
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

  function* generateKeyOrders(length) {
    const values = Array.from({ length }, (_, index) => index + 1);
    const used = Array.from({ length }, () => false);
    const current = [];

    function* backtrack(depth) {
      if (depth === length) {
        yield current.slice();
        return;
      }

      for (let index = 0; index < length; index += 1) {
        if (used[index]) {
          continue;
        }
        used[index] = true;
        current.push(values[index]);
        yield* backtrack(depth + 1);
        current.pop();
        used[index] = false;
      }
    }

    yield* backtrack(0);
  }

  function buildCandidates(text, lengthsToTest) {
    const candidates = [];

    for (const length of lengthsToTest) {
      for (const keyOrder of generateKeyOrders(length)) {
        const rawText = decryptColumnar(text, keyOrder);
        candidates.push({
          key: formatKey(keyOrder),
          keyOrder,
          text: rawText,
          rawText,
          confidence: fallbackScore(rawText),
        });
      }
    }

    candidates.sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      if (a.keyOrder.length !== b.keyOrder.length) {
        return a.keyOrder.length - b.keyOrder.length;
      }
      return a.key.localeCompare(b.key);
    });

    const scorer = getDictionaryScorer();
    if (scorer && typeof scorer.analyzeTextQuality === "function" && candidates.length > 0) {
      const shortlistSize = Math.min(ANALYSIS_SHORTLIST_SIZE, candidates.length);

      // Die Shortlist begrenzt teures Shared-Scoring, ohne den Suchraum zu beschneiden.
      for (let index = 0; index < shortlistSize; index += 1) {
        const candidate = candidates[index];
        const scored = analyzeCandidateText(candidate.rawText);
        candidate.text = scored.text;
        candidate.rawText = scored.rawText;
        candidate.confidence = scored.confidence;
      }

      candidates.sort((a, b) => {
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence;
        }
        if (a.keyOrder.length !== b.keyOrder.length) {
          return a.keyOrder.length - b.keyOrder.length;
        }
        return a.key.localeCompare(b.key);
      });
    }

    return candidates;
  }

  root.columnarTranspositionCipher = {
    id: "columnar-transposition",
    name: "Columnar Transposition",
    supportsKey: true,
    supportsCrackLengthHint: true,
    reuseKeyForCrackHint: false,
    keyLabel: "Spaltenreihenfolge",
    keyPlaceholder: "z. B. 3-1-4-2 oder ZEBRA",
    crackLengthLabel: "Spaltenanzahl",
    crackLengthPlaceholder: "z. B. 4",
    info: {
      purpose:
        "Transposition mit Spaltenreihenfolge: Der Text wird zeilenweise geschrieben und spaltenweise ausgelesen.",
      process:
        "Die Eingabe wird auf A-Z normalisiert, mit X auf volle Spaltenbreite gepaddet und in Schlüsselreihenfolge ausgelesen.",
      crack:
        "Ohne Schlüssel werden alle Permutationen bis Länge 6 getestet und per Sprach-Scoring bewertet.",
      useCase:
        "Geeignet für klassische Übungsaufgaben, bei denen Reihenfolge-Keys oder Schlüsselwörter genutzt werden.",
    },

    parseKey(rawKey) {
      return parseKey(rawKey);
    },

    encrypt(text, key) {
      const order = this.parseKey(key);
      return encryptColumnar(text, order);
    },

    decrypt(text, key) {
      const order = this.parseKey(key);
      // decrypt() liefert die rohe Inversion inklusive Padding, damit Lernfälle exakt reproduzierbar bleiben.
      return decryptColumnar(text, order);
    },

    crack(text, options) {
      const source = toColumnarAZ(text);
      const minColumns = 2;

      if (source.length <= 1) {
        const fallbackKey = formatKey([1, 2]);
        return {
          key: fallbackKey,
          text: source,
          rawText: source,
          confidence: fallbackScore(source),
          candidates: [
            {
              key: fallbackKey,
              text: source,
              rawText: source,
              confidence: fallbackScore(source),
            },
          ],
        };
      }

      const maxColumns = Math.min(6, Math.max(minColumns, source.length));
      let lengthsToTest = [];

      if (Number.isFinite(options && options.keyLength)) {
        const hinted = Math.max(minColumns, Math.min(maxColumns, Math.floor(options.keyLength)));
        lengthsToTest = [hinted];
      } else {
        for (let length = minColumns; length <= maxColumns; length += 1) {
          lengthsToTest.push(length);
        }
      }

      const candidates = buildCandidates(source, lengthsToTest);
      const best = candidates[0];
      const sanitizedCandidates = candidates.slice(0, 8).map((candidate) => ({
        key: candidate.key,
        text: candidate.text,
        rawText: candidate.rawText,
        confidence: candidate.confidence,
      }));

      return {
        key: best ? best.key : formatKey([1, 2]),
        text: best ? best.text : source,
        rawText: best ? best.rawText : source,
        confidence: best ? best.confidence : fallbackScore(source),
        candidates: sanitizedCandidates,
      };
    },
  };
})(window);
