(function initHillCipher(global) {
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

  const MODULUS = 26;

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

  function toHillAZ(text) {
    return normalizeBase(text).replace(/[^A-Z]/g, "");
  }

  function padToMultiple(text, size) {
    const remainder = text.length % size;
    if (remainder === 0) {
      return text;
    }
    // Padding stabilisiert die Blocklänge, damit Inversion und Segmentierung nicht auseinanderlaufen.
    return text + "X".repeat(size - remainder);
  }

  function mod(value, modulo = MODULUS) {
    return ((value % modulo) + modulo) % modulo;
  }

  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
      const temp = x % y;
      x = y;
      y = temp;
    }
    return x;
  }

  function modInverse(value, modulo = MODULUS) {
    let a = mod(value, modulo);
    let t = 0;
    let newT = 1;
    let r = modulo;
    let newR = a;

    while (newR !== 0) {
      const quotient = Math.floor(r / newR);
      [t, newT] = [newT, t - quotient * newT];
      [r, newR] = [newR, r - quotient * newR];
    }

    if (r !== 1) {
      return null;
    }

    return mod(t, modulo);
  }

  function chunk(text, size) {
    const blocks = [];
    for (let index = 0; index < text.length; index += size) {
      blocks.push(text.slice(index, index + size));
    }
    return blocks;
  }

  function matrixMultiplyVector(matrix, vector, modulo = MODULUS) {
    const size = matrix.length;
    const output = new Array(size).fill(0);

    for (let row = 0; row < size; row += 1) {
      let sum = 0;
      for (let col = 0; col < size; col += 1) {
        sum += matrix[row][col] * vector[col];
      }
      output[row] = mod(sum, modulo);
    }

    return output;
  }

  function cloneMatrix(matrix) {
    return matrix.map((row) => row.slice());
  }

  function buildMinor(matrix, removeRow, removeCol) {
    const minor = [];
    for (let row = 0; row < matrix.length; row += 1) {
      if (row === removeRow) {
        continue;
      }
      const newRow = [];
      for (let col = 0; col < matrix.length; col += 1) {
        if (col === removeCol) {
          continue;
        }
        newRow.push(matrix[row][col]);
      }
      minor.push(newRow);
    }
    return minor;
  }

  function determinant(matrix, modulo = MODULUS) {
    const size = matrix.length;
    if (size === 1) {
      return mod(matrix[0][0], modulo);
    }
    if (size === 2) {
      return mod(matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0], modulo);
    }

    let det = 0;
    for (let col = 0; col < size; col += 1) {
      const sign = col % 2 === 0 ? 1 : -1;
      const minor = buildMinor(matrix, 0, col);
      det = mod(det + sign * matrix[0][col] * determinant(minor, modulo), modulo);
    }
    return det;
  }

  function adjugate(matrix, modulo = MODULUS) {
    const size = matrix.length;
    const adj = Array.from({ length: size }, () => new Array(size).fill(0));

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const sign = (row + col) % 2 === 0 ? 1 : -1;
        const minor = buildMinor(matrix, row, col);
        const cofactor = mod(sign * determinant(minor, modulo), modulo);
        // Transponieren, damit die Adjunkte direkt entsteht.
        adj[col][row] = cofactor;
      }
    }

    return adj;
  }

  function invertMatrixMod(matrix, modulo = MODULUS) {
    const size = matrix.length;
    const normalized = cloneMatrix(matrix).map((row) => row.map((value) => mod(value, modulo)));
    const det = determinant(normalized, modulo);
    const detInv = modInverse(det, modulo);
    if (detInv == null) {
      return null;
    }

    if (size === 1) {
      return [[detInv]];
    }

    const adj = adjugate(normalized, modulo);
    return adj.map((row) => row.map((value) => mod(value * detInv, modulo)));
  }

  function validateAndNormalizeMatrix(rawKey) {
    let matrix = rawKey;

    if (rawKey && typeof rawKey === "object" && Array.isArray(rawKey.matrix)) {
      matrix = rawKey.matrix;
    }

    if (!Array.isArray(matrix) || matrix.length < 2) {
      throw new Error("Schlüsselmatrix muss mindestens 2×2 groß sein.");
    }

    const size = matrix.length;
    const normalized = [];

    for (let row = 0; row < size; row += 1) {
      const sourceRow = matrix[row];
      if (!Array.isArray(sourceRow) || sourceRow.length !== size) {
        throw new Error("Schlüsselmatrix muss quadratisch sein.");
      }

      const normalizedRow = [];
      for (let col = 0; col < size; col += 1) {
        const value = Number(sourceRow[col]);
        if (!Number.isFinite(value) || !Number.isInteger(value)) {
          throw new Error("Schlüsselmatrix darf nur aus ganzen Zahlen bestehen.");
        }
        normalizedRow.push(mod(value, MODULUS));
      }
      normalized.push(normalizedRow);
    }

    const inverse = invertMatrixMod(normalized, MODULUS);
    if (!inverse) {
      throw new Error("Schlüsselmatrix ist nicht invertierbar modulo 26.");
    }

    const keyString = JSON.stringify(normalized);
    const key = {
      matrix: normalized,
      size,
      keyString,
      // Statusmeldungen nutzen `${key}`; toString liefert die Matrix lesbar statt [object Object].
      toString() {
        return this.keyString;
      },
    };

    return key;
  }

  function keyToMatrix(rawKey) {
    if (rawKey && typeof rawKey === "object" && Array.isArray(rawKey.matrix)) {
      return rawKey.matrix;
    }
    if (Array.isArray(rawKey)) {
      return rawKey;
    }
    throw new Error("Schlüsselmatrix fehlt oder hat ein unbekanntes Format.");
  }

  function encryptHill(text, key) {
    const matrix = keyToMatrix(key);
    const size = matrix.length;
    const normalized = padToMultiple(toHillAZ(text), size);
    if (!normalized) {
      return "";
    }

    const blocks = chunk(normalized, size);
    let output = "";

    for (const block of blocks) {
      const vector = Array.from(block).map((char) => char.charCodeAt(0) - 65);
      const encoded = matrixMultiplyVector(matrix, vector, MODULUS);
      output += encoded.map((value) => String.fromCharCode(65 + value)).join("");
    }

    return output;
  }

  function decryptHill(text, key) {
    const matrix = keyToMatrix(key);
    const size = matrix.length;
    const normalized = padToMultiple(toHillAZ(text), size);
    if (!normalized) {
      return "";
    }

    const inverse = invertMatrixMod(matrix, MODULUS);
    if (!inverse) {
      throw new Error("Schlüsselmatrix ist nicht invertierbar modulo 26.");
    }

    const blocks = chunk(normalized, size);
    let output = "";

    for (const block of blocks) {
      const vector = Array.from(block).map((char) => char.charCodeAt(0) - 65);
      const decoded = matrixMultiplyVector(inverse, vector, MODULUS);
      output += decoded.map((value) => String.fromCharCode(65 + value)).join("");
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
        // Wenn Coverage sehr gering ist, wird das bereits segmentierte Ergebnis nochmals bewertet.
        analysis = scorer.analyzeTextQuality(initialDisplayText, {
          languageHints: ["de", "en"],
          maxWordLength: 40,
        });
      }

      if (analysis) {
        const coverage = Number(analysis.coverage) || 0;
        const qualityScore = Number(analysis.qualityScore) || 0;
        const meaningfulTokenRatio = Number(analysis.meaningfulTokenRatio) || 0;
        const domainBonus = computeDomainBonus(scoringText);
        const preferredDisplay = analysis.displayText || scoringText;
        return {
          text: preferredDisplay,
          rawText,
          confidence: qualityScore + coverage * 10 + meaningfulTokenRatio * 7 + domainBonus,
          coverage,
          meaningfulTokenRatio,
          qualityScore,
        };
      }
    } catch (_error) {
      // Fallback bleibt aktiv, damit Crack auch ohne Scorer stabil läuft.
    }

    return result;
  }

  function quickScoreCandidate(rawText) {
    // Schnelles Pre-Scoring begrenzt den teuren Dictionary-Pfad auf eine Shortlist.
    return fallbackScore(rawText) + computeDomainBonus(rawText);
  }

  function heapSwap(heap, left, right) {
    const temp = heap[left];
    heap[left] = heap[right];
    heap[right] = temp;
  }

  function heapifyUp(heap, index) {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (heap[parent].quickScore <= heap[current].quickScore) {
        break;
      }
      heapSwap(heap, parent, current);
      current = parent;
    }
  }

  function heapifyDown(heap, index) {
    let current = index;
    const length = heap.length;
    while (true) {
      const left = current * 2 + 1;
      const right = current * 2 + 2;
      let smallest = current;

      if (left < length && heap[left].quickScore < heap[smallest].quickScore) {
        smallest = left;
      }
      if (right < length && heap[right].quickScore < heap[smallest].quickScore) {
        smallest = right;
      }
      if (smallest === current) {
        break;
      }
      heapSwap(heap, current, smallest);
      current = smallest;
    }
  }

  function pushToHeap(heap, item, limit) {
    if (heap.length < limit) {
      heap.push(item);
      heapifyUp(heap, heap.length - 1);
      return;
    }
    if (item.quickScore <= heap[0].quickScore) {
      return;
    }
    heap[0] = item;
    heapifyDown(heap, 0);
  }

  function invert2x2Matrix(matrix) {
    const [[a, b], [c, d]] = matrix;
    const det = mod(a * d - b * c, MODULUS);
    const detInv = modInverse(det, MODULUS);
    if (detInv == null) {
      return null;
    }
    return [
      [mod(detInv * d, MODULUS), mod(-detInv * b, MODULUS)],
      [mod(-detInv * c, MODULUS), mod(detInv * a, MODULUS)],
    ];
  }

  function crackHill(text, options = {}) {
    const size = Number.isFinite(options.matrixSize) ? options.matrixSize : 2;
    if (size !== 2) {
      throw new Error("Hill-Bruteforce ist nur für 2×2-Matrizen verfügbar.");
    }

    const normalized = padToMultiple(toHillAZ(text), size);
    if (!normalized) {
      return {
        text: "",
        rawText: "",
        confidence: 0,
        key: null,
        candidates: [],
      };
    }

    const scorer = getDictionaryScorer();
    const useDictionary =
      scorer && typeof scorer.analyzeTextQuality === "function";
    const shortlistLimit = useDictionary ? 400 : 8;
    const blocks = chunk(normalized, size);
    const heap = [];

    for (let a = 0; a < MODULUS; a += 1) {
      for (let b = 0; b < MODULUS; b += 1) {
        for (let c = 0; c < MODULUS; c += 1) {
          for (let d = 0; d < MODULUS; d += 1) {
            const det = mod(a * d - b * c, MODULUS);
            if (gcd(det, MODULUS) !== 1) {
              continue;
            }

            const inverse = invert2x2Matrix([
              [a, b],
              [c, d],
            ]);
            if (!inverse) {
              continue;
            }

            let rawText = "";
            for (const block of blocks) {
              const vector = Array.from(block).map((char) => char.charCodeAt(0) - 65);
              const decoded = matrixMultiplyVector(inverse, vector, MODULUS);
              rawText += decoded.map((value) => String.fromCharCode(65 + value)).join("");
            }

            const quickScore = quickScoreCandidate(rawText);
            pushToHeap(
              heap,
              {
                rawText,
                key: `[[${a},${b}],[${c},${d}]]`,
                quickScore,
              },
              shortlistLimit
            );
          }
        }
      }
    }

    const shortlist = heap.sort((left, right) => right.quickScore - left.quickScore);
    const candidates = shortlist.map((candidate) => {
      if (!useDictionary) {
        return {
          text: candidate.rawText,
          rawText: candidate.rawText,
          confidence: candidate.quickScore,
          key: candidate.key,
        };
      }
      const analyzed = analyzeCandidateText(candidate.rawText);
      return {
        text: analyzed.text,
        rawText: analyzed.rawText,
        confidence: analyzed.confidence,
        key: candidate.key,
        coverage: analyzed.coverage,
        meaningfulTokenRatio: analyzed.meaningfulTokenRatio,
        qualityScore: analyzed.qualityScore,
      };
    });

    candidates.sort((left, right) => right.confidence - left.confidence);

    const best = candidates[0] || { text: "", rawText: "", confidence: 0, key: null };

    return {
      text: best.text,
      rawText: best.rawText,
      confidence: best.confidence,
      key: best.key,
      candidates: candidates.slice(0, 8),
    };
  }

  const hillCipher = {
    id: "hill",
    name: "Hill",
    supportsKey: true,
    supportsMatrixKey: true,
    keyLabel: "Schlüsselmatrix",
    keyPlaceholder: "Matrix eingeben",
    parseKey: validateAndNormalizeMatrix,
    encrypt: encryptHill,
    decrypt: decryptHill,
    crack: crackHill,
    info: {
      purpose: "Lineares Blockchiffre-Verfahren mit Matrizen über dem Alphabet A-Z.",
      process:
        "Texte werden zu Zahlen 0-25 normalisiert, blockweise mit einer n×n-Matrix multipliziert und modulo 26 zurücktransformiert.",
      crack:
        "Keyless-Crack prüft alle invertierbaren 2×2-Matrizen modulo 26 und bewertet den Klartext über Sprach-Scoring.",
      useCase:
        "Geeignet für Unterricht und Matrix-Rechenbeispiele; größere Matrizen erhöhen die Key-Sicherheit.",
    },
  };

  root.hillCipher = hillCipher;
})(window);
