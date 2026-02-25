(function initVigenereCipher(global) {
  const root = global.KryptoCiphers || (global.KryptoCiphers = {});

  const combinedLetterFrequency = [
    0.078, 0.016, 0.031, 0.050, 0.151, 0.018, 0.031, 0.042, 0.070, 0.004, 0.012,
    0.040, 0.026, 0.092, 0.030, 0.009, 0.001, 0.072, 0.067, 0.065, 0.038, 0.012,
    0.015, 0.003, 0.003, 0.011,
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
    "th",
    "he",
    "in",
    "an",
    "re",
  ]);

  function normalizeKey(rawKey) {
    const withoutUmlauts = rawKey
      .replace(/Ä/g, "Ae")
      .replace(/Ö/g, "Oe")
      .replace(/Ü/g, "Ue")
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss");

    const lettersOnly = withoutUmlauts.replace(/[^A-Za-z]/g, "").toUpperCase();
    if (!lettersOnly) {
      throw new Error("Schlüssel muss mindestens einen Buchstaben enthalten.");
    }
    return lettersOnly;
  }

  function keyToShifts(key) {
    const normalized = normalizeKey(key);
    return Array.from(normalized, (char) => char.charCodeAt(0) - 65);
  }

  function shiftsToKey(shifts) {
    return shifts.map((shift) => String.fromCharCode(65 + shift)).join("");
  }

  function shiftLetter(char, shift) {
    const code = char.charCodeAt(0);
    const isUpper = code >= 65 && code <= 90;
    const isLower = code >= 97 && code <= 122;

    if (!isUpper && !isLower) {
      return null;
    }

    const base = isUpper ? 65 : 97;
    return String.fromCharCode(((code - base + shift + 26) % 26) + base);
  }

  function applyWithShifts(text, shifts, direction) {
    let keyIndex = 0;
    let output = "";

    for (const char of text) {
      const shifted = shiftLetter(char, shifts[keyIndex % shifts.length] * direction);
      if (shifted == null) {
        output += char;
        continue;
      }

      output += shifted;
      keyIndex += 1;
    }

    return output;
  }

  function applyVigenere(text, key, direction) {
    return applyWithShifts(text, keyToShifts(key), direction);
  }

  function extractLettersUpper(text) {
    return Array.from(text.toUpperCase()).filter((ch) => ch >= "A" && ch <= "Z");
  }

  function splitIntoColumns(letters, keyLength) {
    const columns = Array.from({ length: keyLength }, () => []);
    for (let i = 0; i < letters.length; i += 1) {
      columns[i % keyLength].push(letters[i]);
    }
    return columns;
  }

  function chiSquaredForShift(columnLetters, shift) {
    if (columnLetters.length === 0) {
      return Infinity;
    }

    const counts = Array(26).fill(0);
    for (const letter of columnLetters) {
      const cipherIndex = letter.charCodeAt(0) - 65;
      const plainIndex = (cipherIndex - shift + 26) % 26;
      counts[plainIndex] += 1;
    }

    let chi = 0;
    for (let i = 0; i < 26; i += 1) {
      const expected = combinedLetterFrequency[i] * columnLetters.length;
      const diff = counts[i] - expected;
      chi += (diff * diff) / Math.max(expected, 0.0001);
    }
    return chi;
  }

  function rankedShiftsForColumn(columnLetters) {
    const ranked = [];
    for (let shift = 0; shift < 26; shift += 1) {
      ranked.push({ shift, chi: chiSquaredForShift(columnLetters, shift) });
    }
    ranked.sort((a, b) => a.chi - b.chi);
    return ranked;
  }

  function buildTopShiftCandidates(text, keyLength, topPerColumn) {
    const letters = extractLettersUpper(text);
    const columns = splitIntoColumns(letters, keyLength);
    return columns.map((column) =>
      rankedShiftsForColumn(column)
        .slice(0, topPerColumn)
        .map((entry) => entry.shift)
    );
  }

  function buildStartKeys(topShiftCandidates, maxStarts) {
    const starts = [];
    const keyLength = topShiftCandidates.length;
    const base = topShiftCandidates.map((candidates) => candidates[0] ?? 0);
    starts.push(base);

    for (let pos = 0; pos < keyLength && starts.length < maxStarts; pos += 1) {
      const options = topShiftCandidates[pos];
      for (let i = 1; i < options.length && starts.length < maxStarts; i += 1) {
        const variant = base.slice();
        variant[pos] = options[i];
        starts.push(variant);
      }
    }

    for (let step = 1; starts.length < maxStarts; step += 1) {
      const variant = [];
      for (let pos = 0; pos < keyLength; pos += 1) {
        const options = topShiftCandidates[pos];
        variant.push(options[(step + pos) % options.length]);
      }
      starts.push(variant);
      if (step > 40) {
        break;
      }
    }

    return starts;
  }

  function languageScore(text) {
    const lower = ` ${text.toLowerCase()} `;
    const commonWords = [
      " der ",
      " die ",
      " und ",
      " ein ",
      " nicht ",
      " ist ",
      " ich ",
      " du ",
      " the ",
      " and ",
      " is ",
      " in ",
      " of ",
      " to ",
    ];

    let score = 0;
    for (const word of commonWords) {
      if (lower.includes(word)) {
        score += 3;
      }
    }

    for (let i = 0; i < lower.length - 1; i += 1) {
      const bg = lower.slice(i, i + 2);
      if (commonBigrams.has(bg)) {
        score += 0.2;
      }
    }

    const lettersOnly = lower.replace(/[^a-z]/g, "");
    if (lettersOnly.length > 0) {
      const vowels = lettersOnly.match(/[aeiou]/g)?.length ?? 0;
      const vowelRatio = vowels / lettersOnly.length;
      score += 3 - Math.abs(0.38 - vowelRatio) * 10;
    }

    const spaces = (lower.match(/\s/g) || []).length;
    score += 1.5 - Math.abs(spaces / Math.max(1, lower.length) - 0.16) * 8;

    return score;
  }

  function hillClimbKey(text, startShifts) {
    const current = startShifts.slice();
    let currentText = applyWithShifts(text, current, -1);
    let currentScore = languageScore(currentText);

    for (let round = 0; round < 6; round += 1) {
      let changed = false;

      for (let pos = 0; pos < current.length; pos += 1) {
        const originalShift = current[pos];
        let bestShift = originalShift;
        let bestText = currentText;
        let bestScore = currentScore;

        for (let shift = 0; shift < 26; shift += 1) {
          if (shift === originalShift) {
            continue;
          }

          current[pos] = shift;
          const trialText = applyWithShifts(text, current, -1);
          const trialScore = languageScore(trialText);

          if (trialScore > bestScore) {
            bestScore = trialScore;
            bestShift = shift;
            bestText = trialText;
          }
        }

        current[pos] = bestShift;
        if (bestShift !== originalShift) {
          changed = true;
          currentText = bestText;
          currentScore = bestScore;
        }
      }

      if (!changed) {
        break;
      }
    }

    return {
      shifts: current,
      key: shiftsToKey(current),
      text: currentText,
      score: currentScore,
    };
  }

  function crackWithLength(text, keyLength) {
    const safeLength = Math.max(1, keyLength);
    const topShiftCandidates = buildTopShiftCandidates(text, safeLength, 4);
    const startKeys = buildStartKeys(topShiftCandidates, 18);

    let best = null;
    for (const start of startKeys) {
      const candidate = hillClimbKey(text, start);
      if (!best || candidate.score > best.score) {
        best = candidate;
      }
    }

    return (
      best || {
        key: "A",
        text,
        score: -Infinity,
      }
    );
  }

  function candidateLengths(text, keyLengthHint) {
    const lettersCount = extractLettersUpper(text).length;
    if (lettersCount === 0) {
      return [1];
    }

    if (keyLengthHint != null) {
      const hinted = Math.max(1, Math.min(Math.floor(keyLengthHint), lettersCount));
      return [hinted];
    }

    const upper = Math.min(14, Math.max(1, Math.floor(lettersCount / 2)));
    const lengths = [];
    for (let len = 1; len <= upper; len += 1) {
      lengths.push(len);
    }
    return lengths;
  }

  root.vigenereCipher = {
    id: "vigenere",
    name: "Vigenère",
    supportsKey: true,
    supportsCrackLengthHint: true,
    keyLabel: "Schlüsselwort",
    keyPlaceholder: "z. B. LEMON",
    crackLengthLabel: "Schlüssellänge",
    crackLengthPlaceholder: "z. B. 6",
    info: {
      purpose:
        "Polyalphabetische Verschlüsselung: Verschiebung wechselt pro Buchstabe nach einem Schlüsselwort.",
      process:
        "Jeder Buchstabe des Schlüsselworts bestimmt eine Cäsar-Verschiebung. Nicht-Buchstaben bleiben unverändert.",
      crack:
        "Das Knacken nutzt Häufigkeitsanalyse je Schlüssel-Position. Wenn die Schlüssellänge bekannt ist, wird es deutlich präziser.",
      useCase:
        "Sinnvoll für klassische Kryptografie-Aufgaben mit Schlüsselwörtern statt Zahlen-Schlüssel.",
    },

    parseKey(rawKey) {
      return normalizeKey(rawKey);
    },

    encrypt(text, key) {
      return applyVigenere(text, key, 1);
    },

    decrypt(text, key) {
      return applyVigenere(text, key, -1);
    },

    crack(text, options) {
      const keyLengthHint =
        options && Number.isInteger(options.keyLength) ? options.keyLength : null;

      let best = {
        key: "A",
        text,
        score: -Infinity,
      };

      for (const length of candidateLengths(text, keyLengthHint)) {
        const candidate = crackWithLength(text, length);
        const adjustedScore = candidate.score - length * 0.08;
        if (adjustedScore > best.score) {
          best = {
            key: candidate.key,
            text: candidate.text,
            score: adjustedScore,
          };
        }
      }

      return {
        key: best.key,
        text: best.text,
        confidence: best.score,
      };
    },
  };
})(window);
