(function initPositionCipher(global) {
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
    "sprung",
  ];
  const CONNECTOR_WORDS = [
    "und",
    "mit",
    "im",
    "der",
    "die",
    "das",
    "ein",
    "eine",
    "einen",
    "den",
    "dem",
    "des",
    "vom",
    "zur",
    "zum",
    "aus",
    "auf",
    "bei",
    "fuer",
    "nur",
    "ist",
    "sind",
  ];
  const DOMAIN_WORD_SET = new Set(DOMAIN_WORDS);
  const CONNECTOR_WORD_SET = new Set(CONNECTOR_WORDS);
  const LEXICON_WORDS = [...DOMAIN_WORDS, ...CONNECTOR_WORDS].map((word) => word.toUpperCase());
  const LEXICON_BY_LENGTH = (() => {
    const map = new Map();
    for (const word of LEXICON_WORDS) {
      const length = word.length;
      if (!map.has(length)) {
        map.set(length, new Set());
      }
      map.get(length).add(word);
    }
    return map;
  })();
  const ANALYSIS_SHORTLIST_SIZE = 16;
  const permutationCache = new Map();

  function normalizeBase(input) {
    let normalized = String(input || "").normalize("NFD");
    // NFD-first stellt sicher, dass Umlaut-Digraphe zuverlässig gesetzt werden, bevor Combining-Marks entfernt werden.
    normalized = normalized
      .replace(/A\u0308|Ä/gi, "AE")
      .replace(/O\u0308|Ö/gi, "OE")
      .replace(/U\u0308|Ü/gi, "UE")
      .replace(/[ßẞ]/g, "SS");
    return normalized.replace(/[\u0300-\u036f]/g, "").toUpperCase();
  }

  function toPositionAZ(text) {
    return normalizeBase(text).replace(/[^A-Z]/g, "");
  }

  function normalizeForComparison(text) {
    return normalizeBase(text).replace(/[^A-Z]/g, "");
  }

  function computeLexiconCoverage(text) {
    const upper = normalizeForComparison(text);
    const total = upper.length;
    if (total === 0) {
      return 0;
    }
    const dp = Array.from({ length: total + 1 }, () => -Infinity);
    dp[0] = 0;

    for (let index = 0; index < total; index += 1) {
      if (dp[index] < 0) {
        continue;
      }
      for (const [length, words] of LEXICON_BY_LENGTH.entries()) {
        const end = index + length;
        if (end > total) {
          continue;
        }
        const slice = upper.slice(index, end);
        if (words.has(slice)) {
          dp[end] = Math.max(dp[end], dp[index] + length);
        }
      }
    }

    const covered = Math.max(...dp);
    return covered / total;
  }

  function padToMultiple(text, blockLength) {
    const remainder = text.length % blockLength;
    if (remainder === 0) {
      return text;
    }
    // Padding stabilisiert die Blockgrenzen, damit Permutation und Inversion exakt bleiben.
    return text + "X".repeat(blockLength - remainder);
  }

  function parseKey(rawKey) {
    const raw = String(rawKey || "").trim();
    if (!raw) {
      throw new Error("Der Schlüssel darf nicht leer sein.");
    }

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

  function formatKey(order) {
    return order.join("-");
  }

  function invertPermutation(order) {
    const inverse = Array.from({ length: order.length }, () => 0);
    // Inverse erzeugt die Originalpositionen, damit Decrypt exakt die Encrypt-Reihenfolge rückgängig macht.
    for (let index = 0; index < order.length; index += 1) {
      inverse[order[index] - 1] = index;
    }
    return inverse;
  }

  function encryptPosition(text, keyOrder) {
    const blockLength = keyOrder.length;
    const normalized = padToMultiple(toPositionAZ(text), blockLength);
    if (!normalized) {
      return "";
    }

    let output = "";

    for (let offset = 0; offset < normalized.length; offset += blockLength) {
      const block = normalized.slice(offset, offset + blockLength);
      // Blockweise Permutation hält den Vorgang lokal, sodass jede Inversion denselben Block rekonstruieren kann.
      for (const order of keyOrder) {
        output += block[order - 1] || "X";
      }
    }

    return output;
  }

  function decryptPosition(text, keyOrder) {
    const blockLength = keyOrder.length;
    const normalized = padToMultiple(toPositionAZ(text), blockLength);
    if (!normalized) {
      return "";
    }

    const inverse = invertPermutation(keyOrder);
    let output = "";

    for (let offset = 0; offset < normalized.length; offset += blockLength) {
      const block = normalized.slice(offset, offset + blockLength);
      // Inverse Permutation stellt die Original-Reihenfolge wieder her, inklusive Padding für stabile Blöcke.
      for (let index = 0; index < blockLength; index += 1) {
        output += block[inverse[index]] || "X";
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

  function computeDomainBonus(text, tokens, scale = 1) {
    if (Array.isArray(tokens) && tokens.length > 0) {
      let bonus = 0;
      for (const token of tokens) {
        const normalized = String(token || "").toLowerCase();
        if (DOMAIN_WORD_SET.has(normalized)) {
          const weight =
            normalized.length >= 8
              ? 3.2
              : normalized.length >= 6
                ? 2.2
                : normalized.length >= 4
                  ? 1.2
                  : 0.4;
          bonus += weight * scale;
          continue;
        }
        if (CONNECTOR_WORD_SET.has(normalized)) {
          const weight = normalized.length <= 2 ? 0.7 : normalized.length <= 3 ? 0.9 : 1.1;
          bonus += weight * scale;
        }
      }
      return bonus;
    }

    const lower = String(text || "").toLowerCase();
    let bonus = 0;

    for (const word of DOMAIN_WORDS) {
      const hits = countWordHits(lower, word);
      if (hits === 0) {
        continue;
      }
      // Kürzere Fachwörter bekommen einen kleineren Bonus, damit Zufallstreffer nicht dominieren.
      const weight = word.length >= 8 ? 3.2 : word.length >= 6 ? 2.2 : word.length >= 4 ? 1.2 : 0.4;
      bonus += hits * weight * scale;
    }

    for (const word of CONNECTOR_WORDS) {
      const hits = countWordHits(lower, word);
      if (hits === 0) {
        continue;
      }
      // Häufige Funktionswörter helfen bei der Positionswahl, dürfen aber nicht dominant werden.
      const weight = word.length <= 2 ? 0.7 : word.length <= 3 ? 0.9 : 1.1;
      bonus += hits * weight * scale;
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

    // Interne X-Häufungen deuten auf falsche Blockzuordnung; korrektes Padding sitzt am Ende.
    return score + computeDomainBonus(lower) - computeInternalXPenalty(text);
  }

  function analyzeCandidateText(rawText, blockLength) {
    const scorer = getDictionaryScorer();
    // Padding-X am Ende verzerren sonst das Sprach-Scoring und drücken korrekte Keys nach unten.
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
      const domainBonus = computeDomainBonus(scoringText, null, 10);
      const lexiconCoverage = computeLexiconCoverage(scoringText);
      const confidence =
        qualityScore +
        coverage * 10 +
        meaningfulTokenRatio * 8 -
        internalXPenalty +
        domainBonus +
        lexiconCoverage * 25;
      const displayText =
        analysis && typeof analysis.displayText === "string"
          ? analysis.displayText.trim()
          : initialDisplayText;

      const normalizedDisplay = normalizeForComparison(displayText || "");
      const normalizedRaw = normalizeForComparison(scoringText);
      // Segmentierung darf keine Buchstaben verlieren, sonst sind Success-Checks und Lerntext verzerrt.
      const safeDisplay = normalizedDisplay === normalizedRaw ? displayText : scoringText;

      // Crack-Score und Ausgabe sollen dieselbe Segmentierung nutzen, ohne Padding zu verlieren.
      result.text = safeDisplay || scoringText;
      result.rawText = rawText;
      result.confidence = confidence;
    } catch (_error) {
      // Optionales Scoring darf isolierte Umgebungen nicht blockieren.
    }

    return result;
  }

  function getPermutations(length) {
    if (permutationCache.has(length)) {
      return permutationCache.get(length);
    }

    const values = Array.from({ length }, (_, index) => index + 1);
    const used = Array.from({ length }, () => false);
    const current = [];
    const permutations = [];

    function backtrack(depth) {
      if (depth === length) {
        permutations.push(current.slice());
        return;
      }

      for (let index = 0; index < length; index += 1) {
        if (used[index]) {
          continue;
        }
        used[index] = true;
        current.push(values[index]);
        backtrack(depth + 1);
        current.pop();
        used[index] = false;
      }
    }

    // Permutationsliste wird nur einmal erzeugt, damit Crack-Läufe stabil performant bleiben.
    backtrack(0);
    permutationCache.set(length, permutations);
    return permutations;
  }

  function compareCandidates(a, b) {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    if (a.keyOrder.length !== b.keyOrder.length) {
      return a.keyOrder.length - b.keyOrder.length;
    }
    return a.key.localeCompare(b.key);
  }

  function buildCandidates(text, lengthsToTest) {
    const candidates = [];

    for (const length of lengthsToTest) {
      const permutations = getPermutations(length);
      for (const keyOrder of permutations) {
        const rawText = decryptPosition(text, keyOrder);
        candidates.push({
          key: formatKey(keyOrder),
          keyOrder,
          text: rawText,
          rawText,
          confidence: fallbackScore(rawText),
        });
      }
    }

    candidates.sort(compareCandidates);

    const scorer = getDictionaryScorer();
    if (scorer && typeof scorer.analyzeTextQuality === "function" && candidates.length > 0) {
      const shortlistSize = Math.min(ANALYSIS_SHORTLIST_SIZE, candidates.length);
      // Die Shortlist begrenzt teures Shared-Scoring, ohne den Suchraum zu beschneiden.
      for (let index = 0; index < shortlistSize; index += 1) {
        const candidate = candidates[index];
        const scored = analyzeCandidateText(candidate.rawText, candidate.keyOrder.length);
        candidate.text = scored.text;
        candidate.rawText = scored.rawText;
        candidate.confidence = scored.confidence;
      }

      candidates.sort(compareCandidates);
    }

    return candidates;
  }

  root.positionCipher = {
    id: "position-cipher",
    name: "Positionscipher",
    supportsKey: true,
    supportsCrackLengthHint: true,
    reuseKeyForCrackHint: false,
    keyLabel: "Positions‑Permutation",
    keyPlaceholder: "z. B. 2-5-3-1-4",
    crackLengthLabel: "Blocklänge",
    crackLengthPlaceholder: "z. B. 5",
    info: {
      purpose:
        "Block-Transposition mit Positionsschlüssel: Jeder Block wird in der angegebenen Positionsreihenfolge gelesen.",
      process:
        "Die Eingabe wird auf A-Z normalisiert, mit X bis zur Blocklänge gepaddet und je Block permutiert.",
      crack:
        "Ohne Schlüssel werden alle Permutationen für Blocklängen 2–6 getestet und per Sprach-Scoring bewertet.",
      useCase:
        "Geeignet für Lernfälle mit kurzer Blocklänge, bei denen die Reihenfolge der Positionen bekannt ist.",
    },

    parseKey(rawKey) {
      return parseKey(rawKey);
    },

    encrypt(text, key) {
      const order = this.parseKey(key);
      return encryptPosition(text, order);
    },

    decrypt(text, key) {
      const order = this.parseKey(key);
      // decrypt() liefert die rohe Inversion inklusive Padding, damit Lernfälle exakt reproduzierbar bleiben.
      return decryptPosition(text, order);
    },

    crack(text, options) {
      const source = toPositionAZ(text);
      const minLength = 2;

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

      const maxLength = Math.max(minLength, source.length);
      let lengthsToTest = [];

      if (Number.isFinite(options && options.keyLength)) {
        const hinted = Math.max(minLength, Math.min(maxLength, Math.floor(options.keyLength)));
        lengthsToTest = [hinted];
      } else {
        const defaultMax = Math.min(6, maxLength);
        for (let length = minLength; length <= defaultMax; length += 1) {
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
