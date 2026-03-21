(function initNumberCaesarCipher(global) {
  const root = global.KryptoCiphers || (global.KryptoCiphers = {});

  function normalizeKey(key) {
    // Normalisierung erlaubt negative Keys und große Werte, ohne UI-Fehler zu erzeugen.
    return ((Number(key) % 26) + 26) % 26;
  }

  function normalizeBase(input) {
    let normalized = String(input || "").normalize("NFD");
    // NFD-first stellt sicher, dass Umlaut-Digraphe sauber entstehen, bevor Combining-Marks verschwinden.
    normalized = normalized
      .replace(/A\u0308|Ä/gi, "AE")
      .replace(/O\u0308|Ö/gi, "OE")
      .replace(/U\u0308|Ü/gi, "UE")
      .replace(/[ßẞ]/g, "SS");
    return normalized.replace(/[\u0300-\u036f]/g, "").toUpperCase();
  }

  function toAZLetters(input) {
    // Die Reduktion auf A-Z hält A1Z26 deterministisch und vermeidet Sonderzeichen-Bias.
    return normalizeBase(input).replace(/[^A-Z]/g, "");
  }

  function shiftAZ(text, shift) {
    const normalized = normalizeKey(shift);
    const letters = String(text || "");
    let output = "";

    // Der Shift ist bewusst auf A-Z beschränkt, damit A1Z26-Inputs immer konsistent bleiben.
    for (let index = 0; index < letters.length; index += 1) {
      const code = letters.charCodeAt(index) - 65;
      if (code >= 0 && code < 26) {
        const shifted = (code + normalized) % 26;
        output += String.fromCharCode(65 + shifted);
      }
    }

    return output;
  }

  function toA1Z26(text) {
    // Der Output bleibt strikt numerisch, damit Parser-Fehler früh erkannt werden.
    return Array.from(String(text || ""), (ch) => String(ch.charCodeAt(0) - 64)).join("-");
  }

  function parseA1Z26(text) {
    const source = String(text || "").trim();
    if (!source) {
      // Leere Eingaben bleiben leer, damit UI-Fehler nicht aus Separatoren entstehen.
      return [];
    }

    if (/[^0-9\s-]/.test(source)) {
      throw new Error("Eingabe darf nur Zahlen, Leerzeichen und '-' enthalten.");
    }

    const tokens = source.split(/[\s-]+/).filter((token) => token.length > 0);
    if (tokens.length === 0) {
      throw new Error("Eingabe muss Zahlen von 1 bis 26 enthalten.");
    }

    return tokens.map((token) => {
      if (!/^\d+$/.test(token)) {
        throw new Error("Eingabe muss aus Zahlen 1 bis 26 bestehen.");
      }
      const value = Number.parseInt(token, 10);
      if (!Number.isFinite(value) || value < 1 || value > 26) {
        throw new Error("Zahlen müssen im Bereich 1 bis 26 liegen.");
      }
      return value;
    });
  }

  function numbersToLetters(numbers) {
    // Die Rückführung auf A-Z ist die Basis für den Caesar-Shift und das Scoring.
    return numbers.map((value) => String.fromCharCode(64 + value)).join("");
  }

  function scoreCandidate(text) {
    // Zahlen-Cäsar nutzt exakt dasselbe Heuristik-Scoring wie der klassische Cäsar.
    const lower = ` ${String(text || "").toLowerCase()} `;
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

  root.numberCaesarCipher = {
    id: "number-caesar",
    name: "Zahlen-Cäsar",
    supportsKey: true,
    keyLabel: "Schlüssel",
    keyPlaceholder: "z. B. 3",
    info: {
      purpose:
        "Buchstaben werden per Cäsar verschoben und anschließend als A1Z26-Zahlen ausgegeben.",
      process:
        "Nach der Normalisierung (A-Z, AE/OE/UE/SS) wird der Text verschoben und als Zahlenfolge mit '-' getrennt ausgegeben.",
      crack:
        "Ohne Schlüssel testet das Programm alle 26 Verschiebungen und wählt den sprachlich plausibelsten Klartext.",
      useCase:
        "Geeignet für Aufgaben, die A1Z26 mit klassischer Cäsar-Verschiebung kombinieren.",
    },

    parseKey(rawKey) {
      const trimmed = String(rawKey ?? "").trim();
      if (!/^-?\d+$/.test(trimmed)) {
        throw new Error("Schlüssel muss eine ganze Zahl sein.");
      }
      const key = Number.parseInt(trimmed, 10);
      // Modulo-Normalisierung hält die Ausgabe stabil, auch bei negativen Eingaben.
      return normalizeKey(key);
    },

    encrypt(text, key) {
      const normalizedKey = this.parseKey(key);
      const normalized = toAZLetters(text);
      const shifted = shiftAZ(normalized, normalizedKey);
      // A1Z26 bleibt ohne Leerzeichen, damit Parser und Tests strikt bleiben.
      return toA1Z26(shifted);
    },

    decrypt(text, key) {
      const normalizedKey = this.parseKey(key);
      const numbers = parseA1Z26(text);
      if (numbers.length === 0) {
        return "";
      }
      const shifted = numbersToLetters(numbers);
      // Rückverschiebung liefert Rohtext ohne Leerzeichen, UI segmentiert später.
      return shiftAZ(shifted, 26 - normalizedKey);
    },

    crack(text) {
      const numbers = parseA1Z26(text);
      if (numbers.length === 0) {
        return {
          key: 0,
          text: "",
          rawText: "",
          confidence: 0,
          candidates: [
            {
              key: 0,
              text: "",
              rawText: "",
              confidence: 0,
            },
          ],
        };
      }

      const shifted = numbersToLetters(numbers);
      const candidates = [];

      for (let key = 0; key < 26; key += 1) {
        const candidateText = shiftAZ(shifted, 26 - key);
        const score = scoreCandidate(candidateText);
        candidates.push({
          key,
          text: candidateText,
          rawText: candidateText,
          confidence: score,
        });
      }

      candidates.sort((a, b) => b.confidence - a.confidence);
      const best = candidates[0] || {
        key: 0,
        text: shifted,
        rawText: shifted,
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
