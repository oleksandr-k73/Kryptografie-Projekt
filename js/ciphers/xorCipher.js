(function initXorCipher(global) {
  const root = global.KryptoCiphers || (global.KryptoCiphers = {});

  const DEFAULT_MAX_KEY_LENGTH = 8;
  const HEX_TABLE = Array.from({ length: 256 }, (_value, index) =>
    index.toString(16).padStart(2, "0").toUpperCase()
  );
  const KEY_BYTES_UPPER = Array.from({ length: 26 }, (_value, index) => 0x41 + index);
  const STRICT_ALLOWED = Array.from({ length: 256 }, () => false);
  const ANALYSIS_SHORTLIST_SIZE = 120;
  const PER_LENGTH_ANALYSIS = 12;
  const STRICT_POSITION_CANDIDATE_CAP = 26;
  const LETTER_FREQUENCY = [
    0.0817, 0.0149, 0.0278, 0.0425, 0.127, 0.0223, 0.0202, 0.0609, 0.0697,
    0.0015, 0.0077, 0.0403, 0.0241, 0.0675, 0.0751, 0.0193, 0.001, 0.0599,
    0.0633, 0.0906, 0.0276, 0.0098, 0.0236, 0.0015, 0.0197, 0.0007,
  ];

  // Striktes Alphabet stabilisiert Hints, weil XOR-Demos meist A-Z, Ziffern und Leerzeichen nutzen.
  STRICT_ALLOWED[0x20] = true;
  for (let byte = 0x30; byte <= 0x39; byte += 1) {
    STRICT_ALLOWED[byte] = true;
  }
  for (let byte = 0x41; byte <= 0x5a; byte += 1) {
    STRICT_ALLOWED[byte] = true;
  }

  function getDictionaryScorer() {
    const core = global.KryptoCore;
    return core && core.dictionaryScorer ? core.dictionaryScorer : null;
  }

  function encodeUtf8(text) {
    const source = String(text || "");

    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(source);
    }

    if (typeof Buffer !== "undefined") {
      // Node-Fallback: Tests laufen im VM-Kontext ohne Browser-Encoder.
      return Uint8Array.from(Buffer.from(source, "utf8"));
    }

    // Letzter Fallback haelt UTF-8-Bytes stabil, wenn Browser-APIs fehlen.
    const encoded = unescape(encodeURIComponent(source));
    const bytes = new Uint8Array(encoded.length);
    for (let index = 0; index < encoded.length; index += 1) {
      bytes[index] = encoded.charCodeAt(index);
    }
    return bytes;
  }

  function decodeUtf8(bytes) {
    const source = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes || []);

    if (typeof TextDecoder !== "undefined") {
      return new TextDecoder("utf-8", { fatal: false }).decode(source);
    }

    if (typeof Buffer !== "undefined") {
      // Node-Fallback: So bleiben Tests ohne DOM-Decoder funktionsfaehig.
      return Buffer.from(source).toString("utf8");
    }

    let binary = "";
    for (const byte of source) {
      binary += String.fromCharCode(byte);
    }

    try {
      return decodeURIComponent(escape(binary));
    } catch (_error) {
      // Wenn die Bytes kein valides UTF-8 bilden, geben wir die Rohdarstellung zurueck.
      return binary;
    }
  }

  function normalizeHexInput(text) {
    const normalized = String(text || "")
      .replace(/\s+/g, "")
      .toUpperCase();

    if (normalized.length === 0) {
      return "";
    }

    if (normalized.length % 2 !== 0) {
      throw new Error("HEX-Eingabe muss eine gerade Länge haben.");
    }

    if (!/^[0-9A-F]+$/.test(normalized)) {
      throw new Error("HEX-Eingabe darf nur 0-9 und A-F enthalten.");
    }

    return normalized;
  }

  function bytesToHex(bytes) {
    let output = "";
    for (const byte of bytes) {
      output += HEX_TABLE[byte];
    }
    return output;
  }

  function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let index = 0; index < hex.length; index += 2) {
      bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
    }
    return bytes;
  }

  function parseKey(rawKey) {
    const key = String(rawKey || "");

    if (!key) {
      throw new Error("Schlüssel darf nicht leer sein.");
    }

    for (let index = 0; index < key.length; index += 1) {
      const code = key.charCodeAt(index);
      if (code > 0x7f) {
        // ASCII-Check frueh, damit UI-Fehler klar bleiben statt spaeter als Byte-Fehler.
        throw new Error("Schlüssel muss reines ASCII (0x00-0x7F) sein.");
      }
    }

    return key;
  }

  function keyToBytes(key) {
    const bytes = new Uint8Array(key.length);
    for (let index = 0; index < key.length; index += 1) {
      bytes[index] = key.charCodeAt(index);
    }
    return bytes;
  }

  function xorBytes(dataBytes, keyBytes) {
    const output = new Uint8Array(dataBytes.length);
    const keyLength = keyBytes.length;

    for (let index = 0; index < dataBytes.length; index += 1) {
      output[index] = dataBytes[index] ^ keyBytes[index % keyLength];
    }

    return output;
  }

  function scorePlainByteStrict(byte) {
    if (byte === 0x20) {
      return 3.2;
    }

    if (byte >= 0x41 && byte <= 0x5a) {
      const index = byte - 0x41;
      return 2.4 + LETTER_FREQUENCY[index] * 4.5;
    }

    if (byte >= 0x30 && byte <= 0x39) {
      return 1.4;
    }

    if (byte >= 0x20 && byte <= 0x7e) {
      return -0.8;
    }

    return -5.5;
  }

  function buildScoreTable(scoreFn) {
    // Vorberechnete Tabellen vermeiden Funktionsaufrufe in den inneren Crack-Loops.
    const table = new Array(256);
    for (let byte = 0; byte < 256; byte += 1) {
      table[byte] = scoreFn(byte);
    }
    return table;
  }

  const STRICT_SCORE_TABLE = buildScoreTable(scorePlainByteStrict);

  function buildPositionCandidates(
    cipherBytes,
    keyLength,
    keyAlphabet,
    scoreTable,
    allowedTable,
    candidateCap
  ) {
    // Pro Position werden Schluesselbytes gesammelt, um die Suche auf plausible Kandidaten zu begrenzen.
    const positionCandidates = [];
    let baseScore = 0;

    for (let position = 0; position < keyLength; position += 1) {
      const candidates = [];

      for (const keyByte of keyAlphabet) {
        let score = 0;
        let allowed = true;

        for (let index = position; index < cipherBytes.length; index += keyLength) {
          const plainByte = cipherBytes[index] ^ keyByte;
          if (!allowedTable[plainByte]) {
            allowed = false;
            break;
          }
          score += scoreTable[plainByte];
        }

        if (allowed) {
          candidates.push({ keyByte, score });
        }
      }

      if (candidates.length === 0) {
        // Falls der strikte Filter greift, erweitern wir pro Position, damit Crack nicht blockiert.
        for (const keyByte of keyAlphabet) {
          let score = 0;
          for (let index = position; index < cipherBytes.length; index += keyLength) {
            const plainByte = cipherBytes[index] ^ keyByte;
            score += scoreTable[plainByte];
          }
          candidates.push({ keyByte, score });
        }
      }

      candidates.sort((a, b) => b.score - a.score);
      // Die Kandidatenzahl pro Position wird begrenzt, damit Beam-Search in 1k-Sets bezahlbar bleibt.
      const capped =
        Number.isFinite(candidateCap) && candidateCap > 0
          ? candidates.slice(0, candidateCap)
          : candidates;
      baseScore += capped[0]?.score || 0;
      positionCandidates.push(capped);
    }

    return { positionCandidates, baseScore };
  }

  function beamCombineCandidates(positionCandidates, beamWidth) {
    let beam = [{ keyBytes: [], score: 0 }];

    for (const candidates of positionCandidates) {
      const next = [];
      for (const state of beam) {
        for (const candidate of candidates) {
          next.push({
            keyBytes: [...state.keyBytes, candidate.keyByte],
            score: state.score + candidate.score,
          });
        }
      }

      next.sort((a, b) => b.score - a.score);
      // Beam-Limit schuetzt vor kombinatorischer Explosion bei laengeren Schluesseln.
      beam = next.slice(0, beamWidth);
    }

    return beam;
  }


  function fallbackScore(text) {
    const lower = ` ${String(text || "").toLowerCase()} `;
    const commonWords = [
      " der ",
      " die ",
      " und ",
      " ist ",
      " nicht ",
      " ein ",
      " the ",
      " and ",
      " is ",
      " in ",
      " quanten ",
      " krypt ",
      " signal ",
      " energie ",
      " impuls ",
      " felder ",
      " teilchen ",
      " wellen ",
      " system ",
      " modell ",
      " analyse ",
      " richtung ",
      " kodierung ",
      " stabiler ",
      " robuster ",
      " klarer ",
      " sicherer ",
      " praeziser ",
      " kontrolle ",
      " ausgabe ",
      " pruefung ",
      " bewertung ",
      " fall ",
      " plus ",
      " sowie ",
    ];
    const commonBigrams = new Set([
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
    const commonTrigrams = new Set([
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
      "spr",
      "kry",
    ]);

    let score = 0;

    for (const word of commonWords) {
      if (lower.includes(word)) {
        score += 4;
      }
    }

    for (let index = 0; index < lower.length - 1; index += 1) {
      if (commonBigrams.has(lower.slice(index, index + 2))) {
        score += 0.25;
      }
    }

    for (let index = 0; index < lower.length - 2; index += 1) {
      if (commonTrigrams.has(lower.slice(index, index + 3))) {
        score += 0.55;
      }
    }

    const lettersOnly = lower.replace(/[^a-z]/g, "");
    if (lettersOnly.length > 0) {
      const vowels = lettersOnly.match(/[aeiou]/g)?.length ?? 0;
      const vowelRatio = vowels / lettersOnly.length;
      score += 2.5 - Math.abs(0.38 - vowelRatio) * 9;
    }

    const spaces = (lower.match(/\s/g) || []).length;
    const spaceRatio = spaces / Math.max(lower.length, 1);
    score += 1.5 - Math.abs(0.16 - spaceRatio) * 8;

    return score;
  }

  function analyzeCandidate(text, baseScore, allowedRatio) {
    const rawText = String(text || "");
    const scorer = getDictionaryScorer();

    if (!scorer || typeof scorer.analyzeTextQuality !== "function") {
      return {
        text: rawText,
        confidence: fallbackScore(rawText) + baseScore * 0.012 + allowedRatio * 6,
      };
    }

    try {
      const analysis = scorer.analyzeTextQuality(rawText, {
        languageHints: ["de", "en"],
        maxWordLength: 40,
      });
      const qualityScore = Number(analysis && analysis.qualityScore) || 0;
      const coverage = Number(analysis && analysis.coverage) || 0;
      const meaningfulTokenRatio = Number(analysis && analysis.meaningfulTokenRatio) || 0;
      const spaceRatio = (rawText.match(/\s/g) || []).length / Math.max(rawText.length, 1);
      const spaceBonus = Math.max(0, 1 - Math.abs(spaceRatio - 0.16) * 4);

      return {
        text: rawText,
        confidence:
          qualityScore +
          coverage * 10 +
          meaningfulTokenRatio * 8 +
          spaceBonus +
          baseScore * 0.012 +
          allowedRatio * 6,
      };
    } catch (_error) {
      // Scorer-Ausfaelle sollen den Crack-Pfad nicht blockieren.
      return {
        text: rawText,
        confidence: fallbackScore(rawText) + baseScore * 0.012 + allowedRatio * 6,
      };
    }
  }

  root.xorCipher = {
    id: "xor",
    name: "XOR",
    supportsKey: true,
    supportsCrackLengthHint: true,
    keyLabel: "Schlüssel",
    keyPlaceholder: "z. B. KRYPTO",
    info: {
      purpose:
        "XOR auf UTF-8-Bytes: Jeder Klartext-Byte wird mit dem Schlüssel-Byte verknüpft.",
      process:
        "Text wird in UTF-8 kodiert, mit dem ASCII-Schlüssel ge-xort und als HEX (uppercase) ausgegeben.",
      crack:
        "Das Knacken bewertet pro Position wahrscheinliche Bytes und nimmt den bestbewerteten Schlüssel als Kandidat.",
      useCase:
        "Gut für Byte-basierte Beispiele und zur Demonstration von XOR-Schwächen bei kurzen Schlüsseln.",
    },

    parseKey(rawKey) {
      return parseKey(rawKey);
    },

    normalizeHexInput(text) {
      // UI braucht eine konsistente HEX-Rohdarstellung, auch wenn Whitespace angeliefert wird.
      return normalizeHexInput(text);
    },

    encrypt(text, key) {
      const parsedKey = parseKey(key);
      const keyBytes = keyToBytes(parsedKey);
      const textBytes = encodeUtf8(text);
      const xored = xorBytes(textBytes, keyBytes);
      return bytesToHex(xored);
    },

    decrypt(text, key) {
      const parsedKey = parseKey(key);
      const normalizedHex = normalizeHexInput(text);
      const keyBytes = keyToBytes(parsedKey);
      const cipherBytes = hexToBytes(normalizedHex);
      const plainBytes = xorBytes(cipherBytes, keyBytes);
      return decodeUtf8(plainBytes);
    },

    crack(text, options = {}) {
      const normalizedHex = normalizeHexInput(text);
      const cipherBytes = hexToBytes(normalizedHex);

      if (cipherBytes.length === 0) {
        return {
          key: "",
          text: "",
          rawText: normalizedHex,
          confidence: -Infinity,
          candidates: [],
        };
      }

      const scorer = getDictionaryScorer();
      const maxLength = Math.min(DEFAULT_MAX_KEY_LENGTH, cipherBytes.length);
      const hintedLength = Number(options && options.keyLength);
      const keyLengths = [];

      if (Number.isFinite(hintedLength) && hintedLength > 0) {
        // Hint laesst die Suche konzentriert bleiben, damit Crack nicht unnoetig ausufert.
        keyLengths.push(Math.min(Math.max(1, Math.floor(hintedLength)), cipherBytes.length));
      } else {
        for (let length = 1; length <= maxLength; length += 1) {
          keyLengths.push(length);
        }
      }

      const buildCandidatesForLengths = (
        keyAlphabet,
        scoreTable,
        allowedTable,
        candidateCap,
        beamWidth,
        lengthCap
      ) => {
        // Kandidaten werden laengenweise gebaut, weil XOR-Slices pro Schluessellaenge getrennt zu bewerten sind.
        const candidates = [];
      const lengthInfos = keyLengths.map((keyLength) => ({
        keyLength,
        ...buildPositionCandidates(
          cipherBytes,
          keyLength,
          keyAlphabet,
          scoreTable,
          allowedTable,
          candidateCap
        ),
      }));

        let selectedLengths = lengthInfos;
        if (!Number.isFinite(hintedLength)) {
          // Ohne Hint halten wir die Anzahl tiefer Suchen klein, damit Crack schnell bleibt.
          const cappedLengthLimit =
            Number.isFinite(lengthCap) && lengthCap > 0 ? lengthCap : lengthInfos.length;
          selectedLengths = [...lengthInfos]
            .sort((a, b) => b.baseScore - a.baseScore)
            .slice(0, Math.min(cappedLengthLimit, lengthInfos.length));
        }

        for (const info of selectedLengths) {
          const beam = beamCombineCandidates(info.positionCandidates, beamWidth);

          for (const entry of beam) {
            const keyBytes = Uint8Array.from(entry.keyBytes);
            const plainBytes = xorBytes(cipherBytes, keyBytes);
            const plainText = decodeUtf8(plainBytes);
            const key = String.fromCharCode(...keyBytes);
            let allowedCount = 0;
            for (const byte of plainBytes) {
              if (STRICT_ALLOWED[byte]) {
                allowedCount += 1;
              }
            }
            const allowedRatio = plainBytes.length > 0 ? allowedCount / plainBytes.length : 0;
            const fallbackConfidence =
              fallbackScore(plainText) +
              entry.score * 0.01 +
              allowedRatio * 6 -
              info.keyLength * 0.2;

            candidates.push({
              key,
              text: plainText,
              rawText: normalizedHex,
              confidence: fallbackConfidence,
              _analysisBase: entry.score,
              _allowedRatio: allowedRatio,
              _keyLength: info.keyLength,
            });
          }
        }

        return candidates;
      };

      let candidates = buildCandidatesForLengths(
        KEY_BYTES_UPPER,
        STRICT_SCORE_TABLE,
        STRICT_ALLOWED,
        STRICT_POSITION_CANDIDATE_CAP,
        // Unhinted prueft alle Laengen mit kleinem Beam, um Genauigkeit + Laufzeit zu balancieren.
        Number.isFinite(hintedLength) ? 300 : 70,
        Number.isFinite(hintedLength) ? 1 : keyLengths.length
      );

      candidates.sort((a, b) => b.confidence - a.confidence);

      if (scorer && typeof scorer.analyzeTextQuality === "function") {
        // Nur die Shortlist wird tief bewertet, damit der Crack-Pfad auch bei 1k Tests performant bleibt.
        const shortlist = [];
        const perLengthCounts = new Map();
        for (const candidate of candidates) {
          if (shortlist.length >= ANALYSIS_SHORTLIST_SIZE) {
            break;
          }
          const keyLength = candidate._keyLength;
          const used = perLengthCounts.get(keyLength) || 0;
          if (used >= PER_LENGTH_ANALYSIS) {
            continue;
          }
          perLengthCounts.set(keyLength, used + 1);
          shortlist.push(candidate);
        }
        for (const candidate of shortlist) {
          const analyzed = analyzeCandidate(
            candidate.text,
            candidate._analysisBase,
            candidate._allowedRatio
          );
          candidate.confidence = analyzed.confidence;
        }
        candidates.sort((a, b) => b.confidence - a.confidence);
      }

      for (const candidate of candidates) {
        // Hilfsfeld darf nicht in der UI landen, damit Kandidaten sauber bleiben.
        delete candidate._analysisBase;
        delete candidate._allowedRatio;
        delete candidate._keyLength;
      }

      const best = candidates[0] || {
        key: "",
        text: "",
        rawText: normalizedHex,
        confidence: -Infinity,
      };

      return {
        key: best.key,
        text: best.text,
        rawText: best.rawText,
        confidence: best.confidence,
        candidates: candidates.slice(0, 8),
      };
    },
  };
})(window);
