(function initDictionaryScorer(global) {
  const root = global.KryptoCore || (global.KryptoCore = {});
  const wordCache = new Map();
  const localLexicon = new Set([
    "aber",
    "alles",
    "als",
    "also",
    "am",
    "an",
    "andere",
    "anfang",
    "auch",
    "auf",
    "aus",
    "bei",
    "beim",
    "bin",
    "bis",
    "bisschen",
    "bitte",
    "bist",
    "da",
    "dabei",
    "dann",
    "darauf",
    "dass",
    "das",
    "dein",
    "deine",
    "dem",
    "den",
    "denn",
    "der",
    "des",
    "dich",
    "die",
    "dies",
    "diese",
    "dieser",
    "dir",
    "doch",
    "dort",
    "du",
    "durch",
    "ein",
    "eine",
    "einem",
    "einen",
    "einer",
    "einfach",
    "einmal",
    "er",
    "es",
    "etwas",
    "euch",
    "euer",
    "für",
    "ganz",
    "geben",
    "geht",
    "gegen",
    "gemacht",
    "gerade",
    "gern",
    "gerne",
    "gesehen",
    "gibt",
    "gut",
    "haben",
    "hast",
    "hat",
    "hätte",
    "heute",
    "hier",
    "hin",
    "hinter",
    "ich",
    "ihr",
    "ihre",
    "im",
    "immer",
    "in",
    "ins",
    "ist",
    "ja",
    "jetzt",
    "kann",
    "keine",
    "klein",
    "klar",
    "kommt",
    "können",
    "lassen",
    "leicht",
    "machen",
    "man",
    "mehr",
    "mein",
    "meine",
    "mich",
    "mir",
    "mit",
    "morgen",
    "nach",
    "nein",
    "nicht",
    "noch",
    "nun",
    "nur",
    "oder",
    "ohne",
    "sehr",
    "sein",
    "seine",
    "sich",
    "sie",
    "sind",
    "so",
    "soll",
    "sollte",
    "sowas",
    "über",
    "um",
    "und",
    "uns",
    "unter",
    "viel",
    "vielleicht",
    "von",
    "vor",
    "war",
    "waren",
    "warum",
    "was",
    "wegen",
    "weil",
    "weiter",
    "wenn",
    "wer",
    "werden",
    "wie",
    "wieder",
    "wir",
    "wird",
    "wo",
    "wohl",
    "wollen",
    "wurde",
    "würde",
    "zu",
    "zum",
    "zur",
    "zusammen",
    "classical",
    "classics",
    "classic",
    "quantum",
    "and",
    "are",
    "be",
    "been",
    "but",
    "by",
    "can",
    "could",
    "decode",
    "decrypt",
    "did",
    "do",
    "does",
    "for",
    "from",
    "get",
    "good",
    "great",
    "have",
    "he",
    "her",
    "him",
    "how",
    "if",
    "in",
    "into",
    "is",
    "it",
    "its",
    "just",
    "like",
    "make",
    "more",
    "most",
    "need",
    "not",
    "of",
    "on",
    "one",
    "or",
    "our",
    "out",
    "over",
    "people",
    "really",
    "should",
    "some",
    "text",
    "that",
    "the",
    "their",
    "there",
    "they",
    "this",
    "to",
    "use",
    "was",
    "we",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "will",
    "with",
    "word",
    "words",
    "you",
    "your",
  ]);

  function normalizeWord(word) {
    return word
      .toLowerCase()
      .replace(/[^a-zäöüß]/gi, "")
      .replace(/ß/g, "ss");
  }

  function extractWords(text) {
    const rawWords = text.match(/[A-Za-zÄÖÜäöüß]{3,}/g) || [];
    const unique = [];
    const seen = new Set();
    for (const raw of rawWords) {
      const word = normalizeWord(raw);
      if (!word || seen.has(word)) {
        continue;
      }
      seen.add(word);
      unique.push(word);
      if (unique.length >= 8) {
        break;
      }
    }
    return unique;
  }

  function localWordMatch(word) {
    if (localLexicon.has(word)) {
      return true;
    }

    const stems = [];
    if (word.length > 4) {
      stems.push(word.slice(0, -1));
      stems.push(word.slice(0, -2));
    }
    if (word.length > 6) {
      stems.push(word.slice(0, -3));
    }

    for (const stem of stems) {
      if (localLexicon.has(stem)) {
        return true;
      }
    }
    return false;
  }

  function evaluateTextLocally(words) {
    let validWords = 0;
    for (const word of words) {
      if (localWordMatch(word)) {
        validWords += 1;
      }
    }
    const totalWords = words.length;
    const coverage = totalWords > 0 ? validWords / totalWords : 0;
    return {
      validWords,
      totalWords,
      coverage,
      apiAvailable: false,
      source: "local",
    };
  }

  async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  async function checkWordInLanguage(word, language) {
    const cacheKey = `${language}:${word}`;
    if (wordCache.has(cacheKey)) {
      return wordCache.get(cacheKey);
    }

    const url = `https://api.dictionaryapi.dev/api/v2/entries/${language}/${encodeURIComponent(
      word
    )}`;

    try {
      const response = await fetchWithTimeout(url, 2200);
      const valid = response.ok;
      const result = { valid, apiAvailable: true };
      wordCache.set(cacheKey, result);
      return result;
    } catch (_error) {
      const result = { valid: false, apiAvailable: false };
      wordCache.set(cacheKey, result);
      return result;
    }
  }

  async function evaluateTextWithDictionary(text, languageHints) {
    const words = extractWords(text);
    if (words.length === 0) {
      return {
        validWords: 0,
        totalWords: 0,
        coverage: 0,
        apiAvailable: true,
        source: "none",
      };
    }

    const local = evaluateTextLocally(words);

    const allChecks = [];
    for (const word of words) {
      for (const language of languageHints) {
        allChecks.push(
          checkWordInLanguage(word, language).then((result) => ({
            word,
            language,
            ...result,
          }))
        );
      }
    }

    const checks = await Promise.all(allChecks);
    const byWord = new Map();
    let anyApiAvailable = false;

    for (const check of checks) {
      if (check.apiAvailable) {
        anyApiAvailable = true;
      }
      if (!byWord.has(check.word)) {
        byWord.set(check.word, false);
      }
      if (check.valid) {
        byWord.set(check.word, true);
      }
    }

    let validWords = 0;
    for (const isValid of byWord.values()) {
      if (isValid) {
        validWords += 1;
      }
    }

    const totalWords = byWord.size;
    const coverage = totalWords > 0 ? validWords / totalWords : 0;

    if (!anyApiAvailable) {
      return local;
    }

    const combinedValid = Math.max(validWords, local.validWords);
    const combinedCoverage =
      totalWords > 0 ? combinedValid / totalWords : local.coverage;

    return {
      validWords: combinedValid,
      totalWords,
      coverage: combinedCoverage,
      apiAvailable: true,
      source: "api+local",
    };
  }

  root.dictionaryScorer = {
    async rankCandidates(candidates, options) {
      const languageHints =
        options && Array.isArray(options.languageHints) && options.languageHints.length > 0
          ? options.languageHints
          : ["de", "en"];

      const enriched = await Promise.all(
        candidates.map(async (candidate, index) => {
          const dict = await evaluateTextWithDictionary(candidate.text, languageHints);
          const base = Number(candidate.confidence) || 0;
          const dictBoost = dict.coverage * 20 + dict.validWords * 1.2;
          const zeroPenalty =
            dict.totalWords >= 2 && dict.validWords === 0 ? -3.2 : 0;
          const combinedScore = base * 0.35 + dictBoost + zeroPenalty;
          return {
            ...candidate,
            rankIndex: index,
            localConfidence: base,
            confidence: combinedScore,
            dictionary: dict,
          };
        })
      );

      enriched.sort((a, b) => {
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence;
        }
        return a.rankIndex - b.rankIndex;
      });

      return {
        rankedCandidates: enriched,
        bestCandidate: enriched[0] || null,
        apiAvailable: enriched.some((candidate) => candidate.dictionary.apiAvailable),
      };
    },
  };
})(window);
