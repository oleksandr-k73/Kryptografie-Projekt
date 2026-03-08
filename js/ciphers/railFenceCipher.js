(function initRailFenceCipher(global) {
  const root = global.KryptoCiphers || (global.KryptoCiphers = {});

  const COMMON_WORDS = [
    " der ",
    " die ",
    " und ",
    " ein ",
    " ist ",
    " nicht ",
    " the ",
    " and ",
    " is ",
    " of ",
    " poten",
    " modell",
    " signal",
    " quant",
  ];
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
    "mod",
    "top",
  ]);
  const ANALYSIS_SHORTLIST_SIZE = 6;

  function getDictionaryScorer() {
    const core = global.KryptoCore;
    return core && core.dictionaryScorer ? core.dictionaryScorer : null;
  }

  function buildRailPattern(length, rails) {
    const normalizedRails = Math.max(2, Math.floor(rails));
    const pattern = [];
    let rail = 0;
    let direction = 1;

    for (let index = 0; index < length; index += 1) {
      pattern.push(rail);
      if (rail === 0) {
        direction = 1;
      } else if (rail === normalizedRails - 1) {
        direction = -1;
      }
      rail += direction;
    }

    return pattern;
  }

  function encryptRailFence(text, rails) {
    const source = String(text || "");
    if (source.length <= 1) {
      return source;
    }

    const pattern = buildRailPattern(source.length, rails);
    const buckets = Array.from({ length: rails }, () => []);

    for (let index = 0; index < source.length; index += 1) {
      buckets[pattern[index]].push(source[index]);
    }

    return buckets.map((bucket) => bucket.join("")).join("");
  }

  function decryptRailFence(text, rails) {
    const source = String(text || "");
    if (source.length <= 1) {
      return source;
    }

    const pattern = buildRailPattern(source.length, rails);
    const counts = Array.from({ length: rails }, () => 0);
    for (const rail of pattern) {
      counts[rail] += 1;
    }

    const slices = [];
    let offset = 0;
    for (let rail = 0; rail < rails; rail += 1) {
      const count = counts[rail];
      slices[rail] = source.slice(offset, offset + count).split("");
      offset += count;
    }

    let output = "";
    for (const rail of pattern) {
      output += slices[rail].shift() || "";
    }
    return output;
  }

  function fallbackScore(text) {
    const lower = ` ${String(text || "").toLowerCase()} `;
    let score = 0;

    for (const word of COMMON_WORDS) {
      if (lower.includes(word)) {
        score += 4;
      }
    }

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

    const spaces = (lower.match(/\s/g) || []).length;
    const spaceRatio = spaces / Math.max(lower.length, 1);
    score += 1.5 - Math.abs(0.16 - spaceRatio) * 8;

    return score;
  }

  function analyzeCandidateText(text, rails, maxRails) {
    const rawText = String(text || "");
    const scorer = getDictionaryScorer();
    const spaceRatio = (rawText.match(/\s/g) || []).length / Math.max(rawText.length, 1);
    const result = {
      text: rawText,
      rawText,
      confidence: fallbackScore(rawText) - (rails / Math.max(maxRails, 1)) * 0.35,
    };

    if (!scorer || typeof scorer.analyzeTextQuality !== "function") {
      return result;
    }

    try {
      const analysis = scorer.analyzeTextQuality(rawText, {
        languageHints: ["de", "en"],
        maxWordLength: 40,
      });
      const qualityScore = Number(analysis && analysis.qualityScore) || 0;
      const coverage = Number(analysis && analysis.coverage) || 0;
      const meaningfulTokenRatio = Number(analysis && analysis.meaningfulTokenRatio) || 0;
      const displayText =
        analysis && typeof analysis.displayText === "string"
          ? analysis.displayText.trim()
          : rawText;
      const spaceBonus = Math.max(0, 1 - Math.abs(spaceRatio - 0.16) * 4);

      result.confidence =
        qualityScore +
        coverage * 10 +
        meaningfulTokenRatio * 8 +
        spaceBonus -
        (rails / Math.max(maxRails, 1)) * 0.35;

      // Die Promotion bleibt an harte Qualitätsgrenzen gebunden, damit segmentierte Ausgabe
      // nur dann sichtbar wird, wenn die Shared-Analyse klare Wortgrenzen stützt.
      if (
        !/\s/.test(rawText) &&
        displayText &&
        displayText !== rawText &&
        coverage >= 0.55 &&
        meaningfulTokenRatio >= 0.55
      ) {
        result.text = displayText;
      }

      result.rawText = rawText;
    } catch (_error) {
      // Optionales Shared-Scoring darf isolierte Browser- oder Test-Kontexte nicht blockieren.
    }

    return result;
  }

  function buildRailCandidates(text, railsToTest, maxRails) {
    const scorer = getDictionaryScorer();
    const canUseSharedAnalysis =
      scorer && typeof scorer.analyzeTextQuality === "function" && railsToTest.length > 1;
    const candidates = [];

    for (const rails of railsToTest) {
      const rawText = decryptRailFence(text, rails);
      candidates.push({
        key: rails,
        text: rawText,
        rawText,
        confidence: fallbackScore(rawText) - (rails / Math.max(maxRails, 1)) * 0.35,
      });
    }

    candidates.sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      return a.key - b.key;
    });

    if (canUseSharedAnalysis) {
      const shortlistSize = Math.min(ANALYSIS_SHORTLIST_SIZE, candidates.length);

      // Die Shortlist hält den Crack bei mehreren schweren 1k-Suiten parallel schnell genug,
      // ohne den finalen Score-Pfad für die plausiblen Rails auf lokales Vorscoring zu reduzieren.
      for (let index = 0; index < shortlistSize; index += 1) {
        const candidate = candidates[index];
        const scored = analyzeCandidateText(candidate.rawText, candidate.key, maxRails);
        candidate.text = scored.text;
        candidate.rawText = scored.rawText;
        candidate.confidence = scored.confidence;
      }
    } else if (scorer && typeof scorer.analyzeTextQuality === "function" && candidates.length === 1) {
      const scored = analyzeCandidateText(candidates[0].rawText, candidates[0].key, maxRails);
      candidates[0].text = scored.text;
      candidates[0].rawText = scored.rawText;
      candidates[0].confidence = scored.confidence;
    }

    candidates.sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      return a.key - b.key;
    });

    return candidates;
  }

  root.railFenceCipher = {
    id: "rail-fence",
    name: "Rail Fence",
    supportsKey: true,
    supportsCrackLengthHint: true,
    reuseKeyForCrackHint: true,
    keyLabel: "Schienen",
    keyPlaceholder: "z. B. 3",
    crackLengthLabel: "Schienenanzahl",
    crackLengthPlaceholder: "z. B. 3",
    info: {
      purpose:
        "Zickzack-Transposition über mehrere Schienen: Zeichen werden diagonal geschrieben und zeilenweise ausgelesen.",
      process:
        "Alle Zeichen bleiben erhalten, aber ihre Reihenfolge folgt dem Rail-Muster statt der ursprünglichen Laufreihenfolge.",
      crack:
        "Ohne Schlüssel testet das Programm mehrere Schienenanzahlen und bewertet die entschlüsselten Texte sprachlich.",
      useCase:
        "Geeignet für klassische Transpositionsaufgaben und Dateiinhalte, bei denen Leerzeichen und Satzzeichen erhalten bleiben sollen.",
    },

    parseKey(rawKey) {
      const key = Number.parseInt(rawKey, 10);
      if (!/^\d+$/.test(String(rawKey || "").trim()) || Number.isNaN(key)) {
        throw new Error("Schienen müssen als ganze Zahl angegeben werden.");
      }
      if (key < 2) {
        throw new Error("Schienen müssen mindestens 2 sein.");
      }
      return key;
    },

    encrypt(text, key) {
      const rails = this.parseKey(key);
      return encryptRailFence(text, rails);
    },

    decrypt(text, key) {
      const rails = this.parseKey(key);
      const rawText = decryptRailFence(text, rails);
      const maxRails = Math.max(rails, Math.min(12, Math.max(2, rawText.length - 1)));

      // Bekannte Rails sollen dieselbe lesbare Ausgabe liefern wie der Crack-Pfad,
      // damit das UI nicht je nach Eingabemodus zwischen Rohtext und sinnvoller Segmentierung springt.
      return analyzeCandidateText(rawText, rails, maxRails).text;
    },

    crack(text, options) {
      const source = String(text || "");
      const maxRails = Math.min(12, Math.max(2, source.length - 1));

      if (source.length <= 2) {
        return {
          key: 2,
          text: source,
          rawText: source,
          confidence: fallbackScore(source),
          candidates: [
            {
              key: 2,
              text: source,
              rawText: source,
              confidence: fallbackScore(source),
            },
          ],
        };
      }

      let railsToTest = [];
      if (Number.isFinite(options && options.keyLength)) {
        const hintedRails = Math.max(2, Math.min(maxRails, Math.floor(options.keyLength)));
        railsToTest = [hintedRails];
      } else {
        for (let rails = 2; rails <= maxRails; rails += 1) {
          railsToTest.push(rails);
        }
      }

      const candidates = buildRailCandidates(source, railsToTest, maxRails);
      const best = candidates[0];

      return {
        key: best ? best.key : 2,
        text: best ? best.text : source,
        rawText: best ? best.rawText : source,
        confidence: best ? best.confidence : fallbackScore(source),
        candidates: candidates.slice(0, 8),
      };
    },
  };
})(window);
