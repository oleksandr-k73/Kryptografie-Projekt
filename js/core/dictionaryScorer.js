(function initDictionaryScorer(global) {
  const root = global.KryptoCore || (global.KryptoCore = {});
  const wordCache = new Map();
  const DEFAULT_LANGUAGE_HINTS = ["de", "en"];
  const MAX_WORDS_PER_TEXT = 16;

  const localLexiconByLanguage = {
    de: new Set([
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
    ]),
    en: new Set([
      "and",
      "are",
      "be",
      "been",
      "but",
      "by",
      "can",
      "cant",
      "classical",
      "classics",
      "classic",
      "decode",
      "decrypt",
      "did",
      "do",
      "does",
      "dont",
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
      "nt",
      "of",
      "on",
      "one",
      "or",
      "our",
      "out",
      "over",
      "pass",
      "people",
      "quantum",
      "really",
      "shall",
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
    ]),
  };

  const localLexiconLanguages = Object.keys(localLexiconByLanguage);

  function normalizeWord(word) {
    return word
      .toLowerCase()
      .replace(/[^a-zäöüß]/gi, "")
      .replace(/ß/g, "ss");
  }

  function normalizeLanguageHint(rawLanguage) {
    const normalized = String(rawLanguage || "").toLowerCase().trim();
    if (normalized.startsWith("de")) {
      return "de";
    }
    if (normalized.startsWith("en")) {
      return "en";
    }
    return null;
  }

  function resolveLanguageHints(rawHints) {
    const source =
      Array.isArray(rawHints) && rawHints.length > 0
        ? rawHints
        : DEFAULT_LANGUAGE_HINTS;
    const hints = [];
    const seen = new Set();

    for (const rawHint of source) {
      const hint = normalizeLanguageHint(rawHint);
      if (!hint || seen.has(hint)) {
        continue;
      }
      seen.add(hint);
      hints.push(hint);
    }

    if (hints.length === 0) {
      return DEFAULT_LANGUAGE_HINTS.slice();
    }
    return hints;
  }

  function extractWords(text) {
    const rawWords = text.match(/[A-Za-zÄÖÜäöüß]{2,}/g) || [];
    const unique = [];
    const seen = new Set();
    for (const raw of rawWords) {
      const word = normalizeWord(raw);
      if (!word || seen.has(word)) {
        continue;
      }
      seen.add(word);
      unique.push(word);
      if (unique.length >= MAX_WORDS_PER_TEXT) {
        break;
      }
    }
    return unique;
  }

  function localWordMatchScore(word, lexicon) {
    if (!lexicon || !word) {
      return 0;
    }

    if (lexicon.has(word)) {
      return 1;
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
      if (lexicon.has(stem)) {
        return 0.72;
      }
    }
    return 0;
  }

  function findWordSegments(word, lexicon) {
    if (!lexicon || word.length < 7 || word.length > 18) {
      return null;
    }

    const maxPartLength = 12;
    const bestByIndex = Array(word.length + 1).fill(null);
    bestByIndex[0] = { score: 0, parts: [] };

    for (let start = 0; start < word.length; start += 1) {
      const state = bestByIndex[start];
      if (!state) {
        continue;
      }

      for (
        let end = start + 2;
        end <= Math.min(word.length, start + maxPartLength);
        end += 1
      ) {
        const part = word.slice(start, end);
        const partScore = localWordMatchScore(part, lexicon);
        if (partScore <= 0) {
          continue;
        }

        const splitPenalty = start > 0 ? 0.18 : 0;
        const score = state.score + part.length * partScore - splitPenalty;
        const candidate = {
          score,
          parts: state.parts.concat(part),
        };
        if (!bestByIndex[end] || score > bestByIndex[end].score) {
          bestByIndex[end] = candidate;
        }
      }
    }

    const best = bestByIndex[word.length];
    if (!best || best.parts.length < 2) {
      return null;
    }

    const normalizedScore = best.score / Math.max(1, word.length);
    if (normalizedScore < 0.82) {
      return null;
    }

    return best.parts;
  }

  function expandWordUnits(word, lexicon) {
    const directScore = localWordMatchScore(word, lexicon);
    const segments = findWordSegments(word, lexicon);

    if (segments && segments.length >= 2) {
      const segmentedScore =
        segments.reduce((acc, part) => acc + localWordMatchScore(part, lexicon), 0) /
        segments.length;
      if (segmentedScore > Math.max(0.86, directScore + 0.08)) {
        return segments.map((part) => ({
          word: part,
          score: localWordMatchScore(part, lexicon),
        }));
      }
    }

    return [{ word, score: directScore }];
  }

  function evaluateWordsForLanguage(words, language) {
    const lexicon = localLexiconByLanguage[language];
    const expanded = [];
    const seen = new Set();
    for (const word of words) {
      const units = expandWordUnits(word, lexicon);
      for (const unit of units) {
        if (!unit.word || seen.has(unit.word)) {
          continue;
        }
        seen.add(unit.word);
        expanded.push(unit);
      }
    }

    let validWords = 0;
    for (const unit of expanded) {
      if (unit.score >= 0.95) {
        validWords += 1;
      } else if (unit.score > 0) {
        validWords += 0.72;
      }
    }

    const totalWords = expanded.length;
    const coverage = totalWords > 0 ? validWords / totalWords : 0;
    return {
      language,
      validWords,
      totalWords,
      coverage,
      apiAvailable: false,
      source: "local",
      words: expanded.map((unit) => unit.word),
    };
  }

  function scoreLanguageStat(stat, hintIndex, totalHints) {
    const hintBonus = (totalHints - hintIndex) * 0.08;
    return stat.coverage * 10 + stat.validWords * 0.6 + hintBonus;
  }

  function bestStatByHintOrder(stats, languageHints) {
    let best = null;
    for (let index = 0; index < languageHints.length; index += 1) {
      const hint = languageHints[index];
      const stat = stats.find((entry) => entry.language === hint);
      if (!stat) {
        continue;
      }

      const quality = scoreLanguageStat(stat, index, languageHints.length);
      if (!best || quality > best.quality) {
        best = { quality, stat, hintIndex: index };
      }
    }

    if (best) {
      return best;
    }

    const fallback = stats[0] || {
      language: "de",
      validWords: 0,
      totalWords: 0,
      coverage: 0,
      apiAvailable: false,
      source: "none",
      words: [],
    };
    return {
      quality: scoreLanguageStat(fallback, 0, Math.max(1, languageHints.length)),
      stat: fallback,
      hintIndex: 0,
    };
  }

  function evaluateTextLocally(words, languageHints) {
    const stats = languageHints
      .filter((hint) => localLexiconLanguages.includes(hint))
      .map((hint) => evaluateWordsForLanguage(words, hint));

    if (stats.length === 0) {
      return {
        validWords: 0,
        totalWords: words.length,
        coverage: 0,
        language: languageHints[0] || "de",
        apiAvailable: false,
        source: "local",
        words: words.slice(0, MAX_WORDS_PER_TEXT),
      };
    }

    const best = bestStatByHintOrder(stats, languageHints);
    return {
      ...best.stat,
      preferredHint: best.hintIndex === 0,
      byLanguage: stats,
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

  // Quick probe to determine if the dictionary API is reachable for a given language.
  // This avoids attempting many per-word network calls when the API is down or slow.
  async function probeDictionaryApi(language, timeoutMs = 800) {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/${language}/test`;
    try {
      const resp = await fetchWithTimeout(url, timeoutMs);
      return Boolean(resp && resp.ok);
    } catch (_e) {
      return false;
    }
  }

  async function evaluateTextWithDictionary(text, languageHints) {
    const normalizedHints = resolveLanguageHints(languageHints);
    const words = extractWords(text);
    if (words.length === 0) {
      return {
        validWords: 0,
        totalWords: 0,
        coverage: 0,
        language: normalizedHints[0],
        apiAvailable: true,
        source: "none",
        words: [],
      };
    }

    const local = evaluateTextLocally(words, normalizedHints);
    const wordsForApi = local.words.slice(0, MAX_WORDS_PER_TEXT);

    const allChecks = [];
    for (const word of wordsForApi) {
      for (const language of normalizedHints) {
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
    const byLanguage = new Map();
    for (const language of normalizedHints) {
      byLanguage.set(language, new Map());
    }
    let anyApiAvailable = false;

    for (const check of checks) {
      if (check.apiAvailable) {
        anyApiAvailable = true;
      }
      if (!byLanguage.has(check.language)) {
        continue;
      }
      byLanguage.get(check.language).set(check.word, Boolean(check.valid));
    }

    if (!anyApiAvailable) {
      return local;
    }

    const combinedByLanguage = normalizedHints.map((language, hintIndex) => {
      const localPerLanguage =
        (local.byLanguage || []).find((entry) => entry.language === language) ||
        evaluateWordsForLanguage(words, language);
      const apiChecksForLanguage = byLanguage.get(language) || new Map();
      let apiValidWords = 0;
      for (const isValid of apiChecksForLanguage.values()) {
        if (isValid) {
          apiValidWords += 1;
        }
      }

      const totalWords = Math.max(
        localPerLanguage.totalWords,
        apiChecksForLanguage.size
      );
      const combinedValid = Math.max(localPerLanguage.validWords, apiValidWords);
      const coverage = totalWords > 0 ? combinedValid / totalWords : 0;
      return {
        language,
        validWords: combinedValid,
        totalWords,
        coverage,
        apiAvailable: true,
        source: "api+local",
        words: localPerLanguage.words.slice(),
        preferredHint: hintIndex === 0,
      };
    });

    const best = bestStatByHintOrder(combinedByLanguage, normalizedHints).stat;

    return {
      ...best,
      apiAvailable: true,
      byLanguage: combinedByLanguage,
    };
  }

  root.dictionaryScorer = {
    async rankCandidates(candidates, options) {
      const languageHints = resolveLanguageHints(
        options && Array.isArray(options.languageHints) ? options.languageHints : null
      );

      // First: evaluate all candidates locally (fast, deterministic).
      // This produces a per-candidate local `dictionary` stat so ranking
      // respects languageHints even when the online API is unreachable.
      const localEvaluated = candidates.map((candidate, index) => {
        const base = Number(candidate.confidence) || 0;
        const words = extractWords(candidate.text || "");
        const localDict = evaluateTextLocally(words, languageHints);
        const dictBoostLocal = localDict.coverage * 20 + localDict.validWords * 1.2;
        const zeroPenaltyLocal = localDict.totalWords >= 2 && localDict.validWords === 0 ? -3.2 : 0;
        const languagePriorityBonusLocal = localDict.preferredHint ? 0.8 : 0;
        const combinedLocal = base * 0.35 + dictBoostLocal + zeroPenaltyLocal + languagePriorityBonusLocal;
        return {
          ...candidate,
          rankIndex: index,
          localConfidence: base,
          // Rohwert bleibt erhalten, damit ein späteres API-Rescoring nicht den
          // bereits lokal gemischten Score ein zweites Mal abdämpft.
          rawConfidence: base,
          confidence: combinedLocal,
          dictionary: localDict,
        };
      });

      // Sort by precomputed local confidence to select a small set for expensive API checks
      localEvaluated.sort((a, b) => b.confidence - a.confidence || a.rankIndex - b.rankIndex);

      const TOP_API_CHECK = Math.min(8, Math.max(1, Math.floor(localEvaluated.length * 0.12)) || 1);
      const toApi = localEvaluated.slice(0, TOP_API_CHECK);

      // Reachability wird über alle Hint-Sprachen geprüft; so vermeiden wir False-Negatives,
      // wenn nur eine Teilmenge der Sprachen gerade API-seitig erreichbar ist.
      const probeHints = languageHints.length > 0 ? languageHints : ["en"];
      const probeResults = await Promise.all(
        probeHints.map((language) => probeDictionaryApi(language).catch(() => false))
      );
      const apiReachable = probeResults.some((reachable) => reachable === true);

      let apiResults = [];
      if (apiReachable) {
        // Perform dictionary/online evaluation only for top candidates to avoid many parallel network calls
        apiResults = await Promise.all(
          toApi.map(async (candidate) => {
            const dict = await evaluateTextWithDictionary(candidate.text, languageHints);
            // API-Reweighting startet vom Rohscore, damit lokal bereits gemischte
            // Confidence nicht nochmals mit dem 0.35-Faktor gedämpft wird.
            const base = Number(candidate.rawConfidence) || 0;
            const dictBoost = dict.coverage * 20 + dict.validWords * 1.2;
            const zeroPenalty = dict.totalWords >= 2 && dict.validWords === 0 ? -3.2 : 0;
            const languagePriorityBonus = dict.preferredHint ? 0.8 : 0;
            const combinedScore = base * 0.35 + dictBoost + zeroPenalty + languagePriorityBonus;
            return {
              index: candidate.rankIndex,
              combinedScore,
              dictionary: dict,
            };
          })
        );
      } else {
        // API not reachable; keep local scores only
        apiResults = [];
      }

      // Merge API results back into localEvaluated
      const apiAvailableFromResults = apiResults.some((r) => r.dictionary && r.dictionary.apiAvailable);
      const apiAvailable = apiReachable || apiAvailableFromResults;
      const merged = localEvaluated.map((entry) => ({ ...entry }));
      for (const res of apiResults) {
        const idx = merged.findIndex((e) => e.rankIndex === res.index);
        if (idx >= 0) {
          merged[idx].dictionary = res.dictionary;
          merged[idx].confidence = res.combinedScore;
        }
      }

      // Final ranking: by confidence (api-refined for top candidates)
      merged.sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return a.rankIndex - b.rankIndex;
      });

      return {
        rankedCandidates: merged,
        bestCandidate: merged[0] || null,
        apiAvailable,
      };
    },
  };
})(window);
