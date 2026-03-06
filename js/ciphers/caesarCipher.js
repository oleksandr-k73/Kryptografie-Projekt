(function initCaesarCipher(global) {
  const root = global.KryptoCiphers || (global.KryptoCiphers = {});

  function normalizeKey(key) {
    return ((Number(key) % 26) + 26) % 26;
  }

  function shiftChar(char, key) {
    const code = char.charCodeAt(0);
    const lowerA = 97;
    const lowerZ = 122;
    const upperA = 65;
    const upperZ = 90;

    if (code >= lowerA && code <= lowerZ) {
      const shifted = ((code - lowerA + key) % 26) + lowerA;
      return String.fromCharCode(shifted);
    }

    if (code >= upperA && code <= upperZ) {
      const shifted = ((code - upperA + key) % 26) + upperA;
      return String.fromCharCode(shifted);
    }

    return char;
  }

  function scoreCandidate(text) {
    const lower = ` ${text.toLowerCase()} `;
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
      " nicht ",
      " ist ",
      " ich ",
      " du ",
      " das ",
      " the ",
      " and ",
      " of ",
      " to ",
      " is ",
      " in ",
      " klassisch ",
      " quanten ",
    ];
    const commonBigrams = [
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
    ];
    const commonTrigrams = [
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
      "ver",
      "che",
      "gen",
      "ten",
      "ter",
      "ere",
      "nde",
      "aus",
      "bei",
      "den",
    ];

    let score = 0;
    for (const word of commonWords) {
      if (lower.includes(word)) {
        score += 4;
      }
    }

    for (let i = 0; i < lower.length - 1; i += 1) {
      const bg = lower.slice(i, i + 2);
      if (commonBigrams.includes(bg)) {
        score += 0.25;
      }
    }

    for (let i = 0; i < lower.length - 2; i += 1) {
      const tg = lower.slice(i, i + 3);
      if (commonTrigrams.includes(tg)) {
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
      score -= chi * 0.035;

      const vowels = lettersOnly.match(/[aeiou]/g)?.length ?? 0;
      const vowelRatio = vowels / lettersOnly.length;
      score += 2.5 - Math.abs(0.38 - vowelRatio) * 9;
    }

    const spaces = (lower.match(/\s/g) || []).length;
    const spaceRatio = spaces / Math.max(lower.length, 1);
    score += 1.5 - Math.abs(0.16 - spaceRatio) * 8;

    return score;
  }

  root.caesarCipher = {
    id: "caesar",
    name: "Cäsar",
    supportsKey: true,
    keyLabel: "Schlüssel",
    keyPlaceholder: "z. B. 3",
    info: {
      purpose:
        "Klassische Buchstabenverschiebung: Jeder Buchstabe wird um eine feste Anzahl Stellen verschoben.",
      process:
        "Mit Schlüssel 3 wird aus A -> D, aus B -> E usw. Groß- und Kleinbuchstaben bleiben erhalten.",
      crack:
        "Ohne Schlüssel testet das Programm alle 26 Möglichkeiten und nimmt den sprachlich plausibelsten Text.",
      useCase:
        "Gut für einfache Aufgaben und zum Lernen von Grundideen der Kryptografie.",
    },

    parseKey(rawKey) {
      const key = Number.parseInt(rawKey, 10);
      if (Number.isNaN(key)) {
        throw new Error("Schlüssel muss eine ganze Zahl sein.");
      }
      return key;
    },

    encrypt(text, key) {
      const normalized = normalizeKey(key);
      return Array.from(text, (ch) => shiftChar(ch, normalized)).join("");
    },

    decrypt(text, key) {
      const normalized = normalizeKey(key);
      return Array.from(text, (ch) => shiftChar(ch, 26 - normalized)).join("");
    },

    crack(text) {
      const candidates = [];
      for (let key = 0; key < 26; key += 1) {
        const candidateText = this.decrypt(text, key);
        const score = scoreCandidate(candidateText);
        candidates.push({
          key,
          text: candidateText,
          confidence: score,
        });
      }

      candidates.sort((a, b) => b.confidence - a.confidence);
      const best = candidates[0] || { key: 0, text, confidence: -Infinity };

      return {
        key: best.key,
        text: best.text,
        confidence: best.confidence,
        candidates: candidates.slice(0, 8),
      };
    },
  };
})(window);
