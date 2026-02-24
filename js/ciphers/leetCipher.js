(function initLeetCipher(global) {
  const root = global.KryptoCiphers || (global.KryptoCiphers = {});

  const encryptMap = {
    a: "4",
    b: "8",
    e: "3",
    g: "6",
    i: "1",
    l: "|",
    o: "0",
    s: "5",
    t: "7",
    z: "2",
  };

  const crackMap = {
    "4": ["a"],
    "@": ["a"],
    "8": ["b"],
    "3": ["e"],
    "6": ["g"],
    "9": ["g"],
    "0": ["o"],
    "5": ["s"],
    "$": ["s"],
    "7": ["t"],
    "+": ["t"],
    "2": ["z"],
    "|": ["l", "i", "|"],
    "1": ["i", "l", "1"],
  };

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

  function scoreLanguage(text) {
    const lower = ` ${text.toLowerCase()} `;

    const commonWords = [
      " der ",
      " die ",
      " und ",
      " ist ",
      " nicht ",
      " ein ",
      " ich ",
      " du ",
      " the ",
      " and ",
      " is ",
      " in ",
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
        score += 0.15;
      }
    }

    const lettersOnly = lower.replace(/[^a-z]/g, "");
    if (lettersOnly.length > 0) {
      const vowels = lettersOnly.match(/[aeiou]/g)?.length ?? 0;
      const vowelRatio = vowels / lettersOnly.length;
      score += 3 - Math.abs(0.38 - vowelRatio) * 10;
    }

    const suspicious = (text.match(/[0-9@$|+]/g) || []).length;
    score -= suspicious * 0.25;

    return score;
  }

  function transitionScore(currentText, nextChar) {
    const last = currentText.at(-1);
    if (!last) {
      return 0;
    }

    const a = last.toLowerCase();
    const b = nextChar.toLowerCase();

    if (/[a-z]/.test(a) && /[a-z]/.test(b) && commonBigrams.has(a + b)) {
      return 0.35;
    }

    if (/[0-9@$|+]/.test(nextChar)) {
      return -0.1;
    }

    if (nextChar === " ") {
      return 0.05;
    }

    return 0;
  }

  function crackBeam(text) {
    const beamWidth = 140;
    let states = [{ text: "", score: 0 }];

    for (const char of text) {
      const options = crackMap[char] || [char];
      const nextStates = [];

      for (const state of states) {
        for (const option of options) {
          const nextText = state.text + option;
          const nextScore = state.score + transitionScore(state.text, option);
          nextStates.push({ text: nextText, score: nextScore });
        }
      }

      nextStates.sort((a, b) => b.score - a.score);
      states = nextStates.slice(0, beamWidth);
    }

    let best = { text, score: -Infinity };
    for (const state of states) {
      const score = state.score + scoreLanguage(state.text);
      if (score > best.score) {
        best = { text: state.text, score };
      }
    }

    return best;
  }

  root.leetCipher = {
    id: "leet",
    name: "Leetspeak",
    supportsKey: false,
    keyLabel: "Schlüssel",
    keyPlaceholder: "Nicht benötigt",
    info: {
      purpose:
        "Ersetzt Buchstaben durch ähnliche Zahlen oder Zeichen, z. B. A -> 4, E -> 3, S -> 5.",
      process:
        "Die Verschlüsselung arbeitet als Substitutionstabelle ohne numerischen Schlüssel.",
      crack:
        "Das Knacken erzeugt mehrere Rückübersetzungen und wählt die sprachlich wahrscheinlichste Variante.",
      useCase:
        "Sinnvoll bei Texten mit vielen Ziffern/Sonderzeichen statt normaler Buchstaben.",
    },

    encrypt(text) {
      let output = "";
      for (const char of text) {
        const lower = char.toLowerCase();
        output += encryptMap[lower] ?? char;
      }
      return output;
    },

    decrypt(text) {
      return this.crack(text).text;
    },

    crack(text) {
      const best = crackBeam(text);
      return {
        key: null,
        text: best.text,
        confidence: best.score,
      };
    },
  };
})(window);
