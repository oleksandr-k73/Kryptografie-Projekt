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
    const germanWords = [
      " der ",
      " die ",
      " und ",
      " ein ",
      " nicht ",
      " ist ",
      " ich ",
      " du ",
    ];
    const englishWords = [
      " the ",
      " and ",
      " of ",
      " to ",
      " is ",
      " in ",
      " that ",
      " it ",
    ];

    let score = 0;
    for (const word of germanWords) {
      if (lower.includes(word)) {
        score += 3;
      }
    }
    for (const word of englishWords) {
      if (lower.includes(word)) {
        score += 2;
      }
    }

    const lettersOnly = lower.replace(/[^a-z]/g, "");
    if (lettersOnly.length > 0) {
      const vowels = lettersOnly.match(/[aeiou]/g)?.length ?? 0;
      const vowelRatio = vowels / lettersOnly.length;
      score += 3 - Math.abs(0.38 - vowelRatio) * 10;
    }

    const spaces = (lower.match(/\s/g) || []).length;
    const spaceRatio = spaces / Math.max(lower.length, 1);
    score += 2 - Math.abs(0.16 - spaceRatio) * 8;

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
      let best = {
        key: 0,
        plaintext: text,
        score: -Infinity,
      };

      for (let key = 0; key < 26; key += 1) {
        const plaintext = this.decrypt(text, key);
        const score = scoreCandidate(plaintext);
        if (score > best.score) {
          best = { key, plaintext, score };
        }
      }

      return {
        key: best.key,
        text: best.plaintext,
        confidence: best.score,
      };
    },
  };
})(window);
