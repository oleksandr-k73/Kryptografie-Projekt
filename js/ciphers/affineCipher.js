(function initAffineCipher(global) {
  const root = global.KryptoCiphers || (global.KryptoCiphers = {});

  const DEFAULT_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  function isLetter(char) {
    return /[A-Za-z]/.test(char);
  }

  function normalizeAlphabet(rawAlphabet) {
    const cleaned = String(rawAlphabet || "").replace(/[\r\n]/g, "");

    if (!cleaned) {
      throw new Error("Alphabet darf nicht leer sein.");
    }

    const seenExact = new Set();
    const seenLetters = new Set();

    for (const ch of cleaned) {
      if (seenExact.has(ch)) {
        throw new Error("Alphabet enthält doppelte Zeichen.");
      }
      seenExact.add(ch);

      if (isLetter(ch)) {
        const lower = ch.toLowerCase();
        if (seenLetters.has(lower)) {
          throw new Error(
            "Alphabet enthält Buchstaben doppelt (Groß-/Kleinschreibung)."
          );
        }
        seenLetters.add(lower);
      }
    }

    return cleaned;
  }

  function buildAlphabetMaps(alphabet) {
    const chars = Array.from(alphabet);
    const exactIndex = new Map();
    const letterIndex = new Map();

    chars.forEach((ch, index) => {
      exactIndex.set(ch, index);
      if (isLetter(ch)) {
        const lower = ch.toLowerCase();
        if (!letterIndex.has(lower)) {
          letterIndex.set(lower, index);
        }
      }
    });

    return {
      alphabet,
      chars,
      exactIndex,
      letterIndex,
    };
  }

  function resolveAlphabet(rawAlphabet) {
    // Alphabet wird zentral normalisiert, damit Key-Parsing, Encrypt/Decrypt und Crack konsistent sind.
    const normalized = normalizeAlphabet(rawAlphabet || DEFAULT_ALPHABET);
    return buildAlphabetMaps(normalized);
  }

  function mod(value, modulo) {
    return ((value % modulo) + modulo) % modulo;
  }

  function gcd(a, b) {
    let left = Math.abs(a);
    let right = Math.abs(b);

    while (right !== 0) {
      const temp = left % right;
      left = right;
      right = temp;
    }

    return left;
  }

  function modInverse(value, modulo) {
    if (modulo === 1) {
      // Degenerierter Fall: nur ein Symbol, Inverses ist effektiv 0.
      return 0;
    }

    let t = 0;
    let newT = 1;
    let r = modulo;
    let newR = mod(value, modulo);

    while (newR !== 0) {
      const quotient = Math.floor(r / newR);
      [t, newT] = [newT, t - quotient * newT];
      [r, newR] = [newR, r - quotient * newR];
    }

    if (r !== 1) {
      return null;
    }

    if (t < 0) {
      t += modulo;
    }

    return t;
  }

  function resolveKey(rawKey, rawAlphabet) {
    if (
      rawKey &&
      typeof rawKey === "object" &&
      Number.isFinite(rawKey.a) &&
      Number.isFinite(rawKey.b)
    ) {
      const maps = resolveAlphabet(rawKey.alphabet || rawAlphabet);
      const modulus = maps.alphabet.length;
      const normalizedA = mod(rawKey.a, modulus);
      const normalizedB = mod(rawKey.b, modulus);

      if (gcd(normalizedA, modulus) !== 1) {
        throw new Error("a muss teilerfremd zur Alphabetlänge sein.");
      }

      return {
        a: normalizedA,
        b: normalizedB,
        alphabet: maps.alphabet,
        toString() {
          return `${normalizedA},${normalizedB}`;
        },
      };
    }

    return root.affineCipher.parseKey(rawKey, { alphabet: rawAlphabet });
  }

  function getIndexForChar(char, maps) {
    if (isLetter(char)) {
      const lower = char.toLowerCase();
      if (maps.letterIndex.has(lower)) {
        return maps.letterIndex.get(lower);
      }
    }

    if (maps.exactIndex.has(char)) {
      return maps.exactIndex.get(char);
    }

    return -1;
  }

  function applyCase(outputChar, sourceChar) {
    if (isLetter(sourceChar) && isLetter(outputChar)) {
      return sourceChar === sourceChar.toLowerCase()
        ? outputChar.toLowerCase()
        : outputChar.toUpperCase();
    }

    return outputChar;
  }

  function scoreCandidate(text) {
    // Bewertungsheuristik entspricht dem Cäsar-Cipher, damit das Crack-Ranking konsistent bleibt.
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

  root.affineCipher = {
    id: "affine",
    name: "Affine",
    supportsKey: true,
    supportsAlphabet: true,
    keyLabel: "Schlüssel (a,b)",
    keyPlaceholder: "z. B. 5,8",
    alphabetLabel: "Alphabet",
    alphabetPlaceholder: DEFAULT_ALPHABET,
    defaultAlphabet: DEFAULT_ALPHABET,
    info: {
      purpose:
        "Affine-Verschlüsselung nutzt zwei Parameter (a,b) und eine lineare Abbildung über ein Alphabet.",
      process:
        "Jeder Buchstabe wird als Index im Alphabet gelesen und per y = (a*x + b) mod m verschoben. Groß-/Kleinschreibung bleibt erhalten.",
      crack:
        "Ohne Schlüssel werden alle teilerfremden a-Werte mit allen b-Offsets getestet und per Sprach-Score gerankt.",
      useCase:
        "Gut für Lernaufgaben rund um modulare Arithmetik und Schlüsselräume mit zwei Parametern.",
    },

    normalizeAlphabet,

    parseKey(rawKey, options) {
      const maps = resolveAlphabet(options && options.alphabet ? options.alphabet : DEFAULT_ALPHABET);
      const matches = String(rawKey || "").match(/-?\d+/g);

      if (!matches || matches.length !== 2) {
        throw new Error("Schlüssel muss zwei ganze Zahlen enthalten (a,b).");
      }

      const modulus = maps.alphabet.length;
      if (modulus <= 0) {
        throw new Error("Alphabet muss mindestens ein Zeichen enthalten.");
      }

      const normalizedA = mod(Number.parseInt(matches[0], 10), modulus);
      const normalizedB = mod(Number.parseInt(matches[1], 10), modulus);

      if (gcd(normalizedA, modulus) !== 1) {
        throw new Error("a muss teilerfremd zur Alphabetlänge sein.");
      }

      return {
        a: normalizedA,
        b: normalizedB,
        alphabet: maps.alphabet,
        toString() {
          return `${normalizedA},${normalizedB}`;
        },
      };
    },

    encrypt(text, key) {
      const resolvedKey = resolveKey(key, key && key.alphabet ? key.alphabet : DEFAULT_ALPHABET);
      const maps = resolveAlphabet(resolvedKey.alphabet);
      const modulus = maps.alphabet.length;

      return Array.from(text, (ch) => {
        const index = getIndexForChar(ch, maps);
        if (index < 0) {
          return ch;
        }
        const encodedIndex = mod(resolvedKey.a * index + resolvedKey.b, modulus);
        return applyCase(maps.alphabet[encodedIndex], ch);
      }).join("");
    },

    decrypt(text, key) {
      const resolvedKey = resolveKey(key, key && key.alphabet ? key.alphabet : DEFAULT_ALPHABET);
      const maps = resolveAlphabet(resolvedKey.alphabet);
      const modulus = maps.alphabet.length;
      const invA = modInverse(resolvedKey.a, modulus);

      if (invA == null) {
        throw new Error("a besitzt kein inverses Element modulo Alphabetlänge.");
      }

      return Array.from(text, (ch) => {
        const index = getIndexForChar(ch, maps);
        if (index < 0) {
          return ch;
        }
        const decodedIndex = mod(invA * (index - resolvedKey.b), modulus);
        return applyCase(maps.alphabet[decodedIndex], ch);
      }).join("");
    },

    crack(text, options) {
      const selectedAlphabet = options && options.alphabet ? options.alphabet : DEFAULT_ALPHABET;
      const maps = resolveAlphabet(selectedAlphabet);
      const modulus = maps.alphabet.length;
      const candidates = [];

      for (let a = 0; a < modulus; a += 1) {
        if (gcd(a, modulus) !== 1) {
          continue;
        }

        for (let b = 0; b < modulus; b += 1) {
          const key = { a, b, alphabet: maps.alphabet };
          const candidateText = this.decrypt(text, key);
          const score = scoreCandidate(candidateText);
          candidates.push({
            key: `${a},${b}`,
            text: candidateText,
            confidence: score,
          });
        }
      }

      candidates.sort((left, right) => right.confidence - left.confidence);
      const best = candidates[0] || { key: "0,0", text, confidence: -Infinity };

      return {
        key: best.key,
        text: best.text,
        confidence: best.confidence,
        candidates: candidates.slice(0, 8),
      };
    },
  };
})(window);
