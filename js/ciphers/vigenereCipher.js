(function initVigenereCipher(global) {
  const root = global.KryptoCiphers || (global.KryptoCiphers = {});

  const combinedLetterFrequency = [
    0.078, 0.016, 0.031, 0.05, 0.151, 0.018, 0.031, 0.042, 0.07, 0.004, 0.012,
    0.04, 0.026, 0.092, 0.03, 0.009, 0.001, 0.072, 0.067, 0.065, 0.038, 0.012,
    0.015, 0.003, 0.003, 0.011,
  ];

  const commonWords = [
    " der ",
    " die ",
    " und ",
    " ein ",
    " ist ",
    " nicht ",
    " ich ",
    " du ",
    " das ",
    " auf ",
    " mit ",
    " von ",
    " the ",
    " and ",
    " of ",
    " to ",
    " is ",
    " in ",
    " for ",
    " vs ",
    " quanten ",
    " klassisch ",
    " verschluesselung ",
    " verschlüsselung ",
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
    "sch",
    "ich",
    "die",
    "der",
    "ein",
    "und",
    "cht",
    "nde",
    "gen",
    "ten",
    "ung",
    "ver",
    "aus",
    "bei",
    "che",
    "ere",
    "ste",
    "ter",
    "eit",
    "nen",
    "den",
    "nch",
    "all",
    "ine",
    "ent",
    "lic",
    "ell",
    "iel",
    "men",
    "sch",
    "the",
    "ing",
    "and",
    "ion",
    "ent",
    "for",
    "ati",
    "ers",
    "ter",
    "tha",
    "ere",
    "hat",
    "his",
    "wit",
    "her",
    "you",
    "not",
    "all",
    "rea",
    "ted",
    "com",
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

  function scoreLanguage(text) {
    const lower = ` ${text.toLowerCase()} `;
    let score = 0;

    for (const word of commonWords) {
      if (lower.includes(word)) {
        score += 4;
      }
    }

    for (let i = 0; i < lower.length - 1; i += 1) {
      if (commonBigrams.has(lower.slice(i, i + 2))) {
        score += 0.22;
      }
    }

    for (let i = 0; i < lower.length - 2; i += 1) {
      if (commonTrigrams.has(lower.slice(i, i + 3))) {
        score += 0.55;
      }
    }

    const lettersOnly = lower.replace(/[^a-z]/g, "");
    if (lettersOnly.length > 0) {
      const counts = Array(26).fill(0);
      for (const ch of lettersOnly) {
        counts[ch.charCodeAt(0) - 97] += 1;
      }

      let chi = 0;
      for (let i = 0; i < 26; i += 1) {
        const expected = combinedLetterFrequency[i] * lettersOnly.length;
        const diff = counts[i] - expected;
        chi += (diff * diff) / Math.max(expected, 0.0001);
      }
      score -= chi * 0.03;

      const vowels = lettersOnly.match(/[aeiou]/g)?.length ?? 0;
      const vowelRatio = vowels / lettersOnly.length;
      score += 2.5 - Math.abs(0.38 - vowelRatio) * 9;
    }

    const spaces = (lower.match(/\s/g) || []).length;
    score += 1.5 - Math.abs(spaces / Math.max(1, lower.length) - 0.16) * 8;

    if (/(.)\1\1\1/.test(lower)) {
      score -= 2;
    }

    return score;
  }

  function indexOfCoincidence(columnLetters) {
    const n = columnLetters.length;
    if (n < 2) {
      return 0;
    }

    const counts = Array(26).fill(0);
    for (const letter of columnLetters) {
      counts[letter.charCodeAt(0) - 65] += 1;
    }

    let sum = 0;
    for (const count of counts) {
      sum += count * (count - 1);
    }
    return sum / (n * (n - 1));
  }

  function avgIocForLength(text, keyLength) {
    const letters = extractLettersUpper(text);
    if (letters.length === 0) {
      return 0;
    }
    const columns = splitIntoColumns(letters, keyLength);
    const values = columns.map(indexOfCoincidence);
    const total = values.reduce((acc, value) => acc + value, 0);
    return total / values.length;
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

    let maxLen = 12;
    if (lettersCount < 10) {
      maxLen = 3;
    } else if (lettersCount < 14) {
      maxLen = 4;
    } else if (lettersCount < 20) {
      maxLen = 5;
    } else if (lettersCount < 40) {
      maxLen = 8;
    }
    maxLen = Math.min(maxLen, Math.max(1, Math.floor(lettersCount / 2)));

    const scored = [];
    for (let len = 1; len <= maxLen; len += 1) {
      const ioc = avgIocForLength(text, len);
      scored.push({
        len,
        quality: -Math.abs(ioc - 0.066),
      });
    }

    scored.sort((a, b) => b.quality - a.quality);
    const top = scored.slice(0, Math.min(5, scored.length)).map((entry) => entry.len);
    if (!top.includes(1)) {
      top.push(1);
    }
    return top;
  }

  function getTopShiftCount(keyLength, hinted) {
    if (hinted) {
      if (keyLength <= 4) {
        return 12;
      }
      if (keyLength <= 6) {
        return 10;
      }
      return 8;
    }

    if (keyLength <= 4) {
      return 7;
    }
    if (keyLength <= 6) {
      return 6;
    }
    if (keyLength <= 8) {
      return 5;
    }
    return 4;
  }

  function reduceTopByBudget(top, keyLength, budget) {
    let current = top;
    while (current > 2) {
      let combos = 1;
      for (let i = 0; i < keyLength; i += 1) {
        combos *= current;
        if (combos > budget) {
          break;
        }
      }
      if (combos <= budget) {
        break;
      }
      current -= 1;
    }
    return current;
  }

  function buildShiftCandidates(columnRanks, topPerColumn, maxStates) {
    let states = [{ shifts: [], chi: 0 }];

    for (const ranks of columnRanks) {
      const nextStates = [];
      const options = ranks.slice(0, topPerColumn);

      for (const state of states) {
        for (const option of options) {
          nextStates.push({
            shifts: state.shifts.concat(option.shift),
            chi: state.chi + option.chi,
          });
        }
      }

      nextStates.sort((a, b) => a.chi - b.chi);
      states = nextStates.slice(0, maxStates);
    }

    return states.map((state) => state.shifts);
  }

  function refineByLocalSearch(text, initialShifts) {
    const shifts = initialShifts.slice();
    let currentText = applyWithShifts(text, shifts, -1);
    let currentScore = scoreLanguage(currentText);

    for (let round = 0; round < 2; round += 1) {
      let changed = false;

      for (let pos = 0; pos < shifts.length; pos += 1) {
        const original = shifts[pos];
        let bestShift = original;
        let bestScore = currentScore;
        let bestText = currentText;

        for (let shift = 0; shift < 26; shift += 1) {
          if (shift === original) {
            continue;
          }
          shifts[pos] = shift;
          const trialText = applyWithShifts(text, shifts, -1);
          const trialScore = scoreLanguage(trialText);
          if (trialScore > bestScore) {
            bestScore = trialScore;
            bestShift = shift;
            bestText = trialText;
          }
        }

        shifts[pos] = bestShift;
        if (bestShift !== original) {
          changed = true;
          currentScore = bestScore;
          currentText = bestText;
        }
      }

      if (!changed) {
        break;
      }
    }

    return {
      key: shiftsToKey(shifts),
      text: currentText,
      score: currentScore,
    };
  }

  function uniqueTopCandidates(candidates, maxCount) {
    const seen = new Set();
    const unique = [];

    for (const candidate of candidates) {
      const id = `${candidate.key}::${candidate.text}`;
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      unique.push(candidate);
      if (unique.length >= maxCount) {
        break;
      }
    }

    return unique;
  }

  function crackWithLength(text, keyLength, hinted) {
    const safeLength = Math.max(1, keyLength);
    const letters = extractLettersUpper(text);
    if (letters.length === 0) {
      return { key: "A", text, score: -Infinity };
    }

    const columns = splitIntoColumns(letters, safeLength);
    const columnRanks = columns.map(rankedShiftsForColumn);

    let maxStates = hinted ? 5000 : 600;
    let topPerColumn = hinted ? 26 : getTopShiftCount(safeLength, hinted);
    if (!hinted) {
      topPerColumn = reduceTopByBudget(topPerColumn, safeLength, 90000);
    } else if (letters.length > 220) {
      maxStates = 1200;
    } else if (letters.length > 90) {
      maxStates = 2500;
    }

    const candidates = buildShiftCandidates(columnRanks, topPerColumn, maxStates);
    const rankedByRaw = [];

    for (const shifts of candidates) {
      const trialText = applyWithShifts(text, shifts, -1);
      const trialScore = scoreLanguage(trialText);
      rankedByRaw.push({ shifts, trialScore });
    }

    rankedByRaw.sort((a, b) => b.trialScore - a.trialScore);
    let refineCount = hinted ? 40 : 12;
    if (hinted && letters.length > 220) {
      refineCount = 12;
    } else if (hinted && letters.length > 90) {
      refineCount = 22;
    }
    const toRefine = rankedByRaw.slice(0, Math.min(refineCount, rankedByRaw.length));
    const refinedCandidates = [];

    for (const item of toRefine) {
      const refined = refineByLocalSearch(text, item.shifts);
      refinedCandidates.push({
        key: refined.key,
        text: refined.text,
        confidence: refined.score,
      });
    }

    refinedCandidates.sort((a, b) => b.confidence - a.confidence);
    const unique = uniqueTopCandidates(refinedCandidates, 12);
    const best = unique[0] || { key: "A", text, confidence: -Infinity };

    return {
      best,
      candidates: unique,
    };
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
      const collectedCandidates = [];

      const lengths = candidateLengths(text, keyLengthHint);
      for (const length of lengths) {
        const result = crackWithLength(text, length, keyLengthHint != null);
        for (const candidate of result.candidates) {
          collectedCandidates.push({
            key: candidate.key,
            text: candidate.text,
            confidence: candidate.confidence - length * 0.12,
            keyLength: length,
          });
        }

        const adjustedScore = result.best.confidence - length * 0.12;
        if (adjustedScore > best.score) {
          best = {
            key: result.best.key,
            text: result.best.text,
            score: adjustedScore,
          };
        }
      }

      collectedCandidates.sort((a, b) => b.confidence - a.confidence);
      const ranked = uniqueTopCandidates(collectedCandidates, 10);

      return {
        key: best.key,
        text: best.text,
        confidence: best.score,
        candidates: ranked,
      };
    },
  };
})(window);
