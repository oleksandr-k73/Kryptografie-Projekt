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
    "abitur",
    "aufgabe",
    "training",
    "berechne",
    "berechnen",
    "welle",
    "wellen",
    "frequenz",
    "richtung",
    "theorie",
    "teilchen",
    "verschränkte",
    "verschraenkte",
    "quanten",
    "analyse",
    "struktur",
    "sicherheit",
    "nachricht",
    "payload",
    "inhalt",
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
      "training",
      "exercise",
      "signal",
      "payload",
      "content",
      "frequency",
      "direction",
      "theory",
      "quant",
      "abitur",
      "task",
    ]),
  };

  const localLexiconLanguages = Object.keys(localLexiconByLanguage);
  const sharedKeySeeds = [
    "quant",
    "quanten",
    "quantum",
    "playfair",
    "cipher",
    "chiffre",
    "krypto",
    "verschluesselung",
    "verschraenkte",
    "teilchen",
    "nachricht",
    "payload",
    "content",
    "message",
    "signal",
  ];
  const keySeedsByLanguage = {
    de: ["schluessel", "verfahren", "sprachmodell", "klassisch", "analyse", "sicherheit"],
    en: ["classic", "didactic", "decode", "decrypt", "language", "structure"],
  };
  const SEGMENT_DOMAIN_WORDS = [
    "abitur",
    "aufgabe",
    "training",
    "berechne",
    "berechnen",
    "welle",
    "wellen",
    "frequenz",
    "richtung",
    "theorie",
    "nachricht",
    "signal",
    "payload",
    "content",
    "message",
    "teilchen",
    "verschraenkte",
    "quanten",
    "feld",
    "modell",
    "krypto",
    "analyse",
    "struktur",
    "sicherheit",
    "workbench",
    "didactic",
    "playfair",
    "code",
    "secret",
    "matrix",
    "enigma",
    "chiffre",
    "cipher",
    "classic",
    "lernen",
    "hinweis",
    "schluessel",
    "klassisch",
    "photoeffekt",
    "messreihe",
    "unschaerfe",
    "fehler",
    "daten",
    "laser",
    "trifft",
    "gitter",
    "dcode",
    "funktioniere",
    "bitte",
    "muss",
    "weiter",
  ];
  // Kurze Exact-Wörter sind erlaubt, aber bewusst selten, damit nicht jedes 3-Zeichen-Fragment splitten darf.
  const SHORT_EXACT_SEGMENT_WORDS = new Set(["ich", "ort"]);
  const segmentModelCache = new Map();
  const unknownSegmentWordCache = new Map();
  const MAX_UNKNOWN_SEGMENT_WORD_CACHE_SIZE = 20000;

  function evictOldUnknownSegmentCacheEntries() {
    if (unknownSegmentWordCache.size < MAX_UNKNOWN_SEGMENT_WORD_CACHE_SIZE) {
      return;
    }

    // Halbierung glättet Cache-Cliffs, ohne den OOV-Hot-Path mit echter LRU-Buchhaltung
    // oder zusätzlicher Runtime-Abhängigkeit zu belasten.
    const deleteCount = Math.max(1, Math.floor(unknownSegmentWordCache.size / 2));
    let deleted = 0;
    for (const cacheKey of unknownSegmentWordCache.keys()) {
      unknownSegmentWordCache.delete(cacheKey);
      deleted += 1;
      if (deleted >= deleteCount) {
        break;
      }
    }
  }
  const HARD_SEGMENT_SUFFIXES = [
    { suffix: "ern", minStemLength: 4, quality: 0.84 },
    { suffix: "ing", minStemLength: 4, quality: 0.84 },
    { suffix: "ed", minStemLength: 4, quality: 0.82 },
    { suffix: "en", minStemLength: 4, quality: 0.81 },
    { suffix: "er", minStemLength: 4, quality: 0.79 },
    { suffix: "es", minStemLength: 4, quality: 0.78 },
    { suffix: "em", minStemLength: 4, quality: 0.78 },
    { suffix: "e", minStemLength: 4, quality: 0.75 },
    { suffix: "n", minStemLength: 4, quality: 0.73 },
    { suffix: "s", minStemLength: 4, quality: 0.72 },
  ];
  const BRIDGE_SEGMENT_WORDS = new Set([
    "am",
    "an",
    "and",
    "are",
    "das",
    "dem",
    "den",
    "der",
    "des",
    "die",
    "ein",
    "eine",
    "einem",
    "einen",
    "einer",
    "er",
    "ihr",
    "im",
    // "mit" als Brücke hält klare Fachkomposita trennbar, ohne neue Vollwörter zu erzwingen.
    "mit",
    "in",
    "is",
    "it",
    "of",
    "on",
    "one",
    "or",
    "the",
    "to",
    "und",
    "zu",
  ]);
  const SHORT_BRIDGE_SEGMENT_WORDS = Array.from(BRIDGE_SEGMENT_WORDS).filter(
    (word) => word.length >= 2 && word.length <= 4
  );
  const COMMON_SEGMENT_BIGRAMS = new Set([
    "an",
    "ar",
    "at",
    "au",
    "be",
    "ch",
    "de",
    "ei",
    "en",
    "er",
    "es",
    "ge",
    "he",
    "ie",
    "in",
    "nd",
    "ne",
    "ng",
    "on",
    "or",
    "ou",
    "qu",
    "ra",
    "re",
    "sc",
    "se",
    "st",
    "te",
    "th",
    "un",
  ]);
  const BRIDGE_SUPPORT_THRESHOLD = 0.66;
  const WEAK_BOUNDARY_SUPPORT_THRESHOLD = 0.6;

  function normalizeWord(word) {
    return word
      .toLowerCase()
      .replace(/[^a-zäöüß]/gi, "")
      .replace(/ß/g, "ss");
  }

  function normalizeKeyToken(word) {
    return String(word || "")
      .replace(/Ä/g, "Ae")
      .replace(/Ö/g, "Oe")
      .replace(/Ü/g, "Ue")
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase();
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

  function extractKeySeedWords(text, limit) {
    const rawWords = String(text || "").match(/[A-Za-zÄÖÜäöüß]{3,}/g) || [];
    const out = [];
    const seen = new Set();
    for (const rawWord of rawWords) {
      const normalized = normalizeWord(rawWord);
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      out.push(normalized);
      if (out.length >= limit) {
        break;
      }
    }
    return out;
  }

  function normalizeCandidateLimit(rawLimit, fallbackLimit) {
    if (!Number.isFinite(rawLimit)) {
      return fallbackLimit;
    }
    return Math.max(20, Math.min(1200, Math.floor(rawLimit)));
  }

  function addKeyCandidateVariants(bucket, rawToken, minLength, maxLength) {
    const token = normalizeKeyToken(rawToken);
    if (!token || token.length < minLength) {
      return;
    }

    if (token.length <= maxLength) {
      bucket.add(token);
    }

    // Präfix-/Stem-Varianten halten den Suchraum klein genug für Browser-Laufzeit,
    // decken aber didaktische Schlüsselabwandlungen für Playfair-Phase B ab.
    for (let len = minLength; len <= Math.min(maxLength, token.length); len += 1) {
      bucket.add(token.slice(0, len));
    }

    for (let trim = 1; trim <= 3; trim += 1) {
      if (token.length - trim >= minLength && token.length - trim <= maxLength) {
        bucket.add(token.slice(0, token.length - trim));
      }
    }
  }

  function getKeyCandidates(options) {
    const normalizedHints = resolveLanguageHints(options && options.languageHints);
    const minLength = Number.isFinite(options && options.minLength)
      ? Math.max(3, Math.min(10, Math.floor(options.minLength)))
      : 4;
    const maxLength = Number.isFinite(options && options.maxLength)
      ? Math.max(minLength, Math.min(16, Math.floor(options.maxLength)))
      : 12;
    const limit = normalizeCandidateLimit(options && options.limit, 220);
    const bucket = new Set();

    for (const seed of sharedKeySeeds) {
      addKeyCandidateVariants(bucket, seed, minLength, maxLength);
    }

    for (const hint of normalizedHints) {
      const languageSeeds = keySeedsByLanguage[hint] || [];
      for (const seed of languageSeeds) {
        addKeyCandidateVariants(bucket, seed, minLength, maxLength);
      }
    }

    const sourceTextWords = extractKeySeedWords(options && options.text, 28);
    for (const word of sourceTextWords) {
      addKeyCandidateVariants(bucket, word, minLength, maxLength);
    }

    const externalSeeds = Array.isArray(options && options.seedWords) ? options.seedWords : [];
    for (const seed of externalSeeds) {
      addKeyCandidateVariants(bucket, seed, minLength, maxLength);
    }

    for (const hint of normalizedHints) {
      const lexicon = localLexiconByLanguage[hint];
      if (!lexicon) {
        continue;
      }
      for (const word of lexicon) {
        addKeyCandidateVariants(bucket, word, minLength, maxLength);
      }
    }

    return Array.from(bucket).slice(0, limit);
  }

  function normalizeSegmentWord(word) {
    return String(word || "")
      .replace(/Ä/g, "Ae")
      .replace(/Ö/g, "Oe")
      .replace(/Ü/g, "Ue")
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  }

  let normalizedDomainWordsCache = null;
  function getNormalizedDomainWords() {
    if (normalizedDomainWordsCache) {
      return normalizedDomainWordsCache;
    }
    const normalized = new Set();
    for (const word of SEGMENT_DOMAIN_WORDS) {
      const normalizedWord = normalizeSegmentWord(word);
      if (normalizedWord.length >= 2) {
        normalized.add(normalizedWord);
      }
    }
    normalizedDomainWordsCache = normalized;
    return normalizedDomainWordsCache;
  }

  function normalizeSegmentSource(text) {
    return String(text || "")
      .replace(/Ä/g, "AE")
      .replace(/Ö/g, "OE")
      .replace(/Ü/g, "UE")
      .replace(/ä/g, "AE")
      .replace(/ö/g, "OE")
      .replace(/ü/g, "UE")
      .replace(/ß/g, "SS")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z]+/g, " ")
      .trim();
  }

  function clampNumber(value, minValue, maxValue) {
    return Math.max(minValue, Math.min(maxValue, value));
  }

  function getSegmentLexiconData() {
    const data = root.segmentLexiconData;
    if (!data || typeof data.getWordSet !== "function" || typeof data.getTrigramModel !== "function") {
      return null;
    }
    return data;
  }

  function getFallbackSegmentTrigramModel() {
    return {
      scores: new Map(),
      floor: -12,
      min: -12,
      max: -3,
    };
  }

  function buildSharedSegmentBaseModel() {
    const lexiconData = getSegmentLexiconData();
    // Cache-Key unterscheidet Fallback vs Vollladung, damit spätere Lexika nicht blockiert werden.
    const cacheKey = lexiconData ? "__shared__" : "__shared__fallback";
    const cached = segmentModelCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const exactLexicon = new Set();
    const domainWords = new Set();
    if (lexiconData) {
      // Das große Offline-Lexikon wird einmal global geteilt, damit Playfair-Cracks
      // kein pro-Request-Set aufbauen müssen.
      for (const word of lexiconData.getWordSet()) {
        exactLexicon.add(word);
      }
    }

    for (const hint of localLexiconLanguages) {
      const words = localLexiconByLanguage[hint];
      if (!words) {
        continue;
      }
      for (const rawWord of words) {
        const normalized = normalizeSegmentWord(rawWord);
        if (normalized.length >= 2) {
          exactLexicon.add(normalized);
        }
      }
    }

    for (const seed of sharedKeySeeds) {
      const normalized = normalizeSegmentWord(seed);
      if (normalized.length >= 2) {
        exactLexicon.add(normalized);
      }
    }

    for (const hint of Object.keys(keySeedsByLanguage)) {
      const languageSeeds = keySeedsByLanguage[hint] || [];
      for (const seed of languageSeeds) {
        const normalized = normalizeSegmentWord(seed);
        if (normalized.length >= 2) {
          exactLexicon.add(normalized);
        }
      }
    }

    for (const seed of SEGMENT_DOMAIN_WORDS) {
      const normalized = normalizeSegmentWord(seed);
      if (normalized.length >= 2) {
        exactLexicon.add(normalized);
        domainWords.add(normalized);
      }
    }

    const model = {
      cacheKey,
      exactLexicon,
      hintLexicon: new Set(),
      bridgeWords: BRIDGE_SEGMENT_WORDS,
      trigramModel: lexiconData ? lexiconData.getTrigramModel() : getFallbackSegmentTrigramModel(),
      domainWords,
    };
    segmentModelCache.set(cacheKey, model);
    return model;
  }

  function resolveSegmentModel(_languageHints, extraWords) {
    const baseModel = buildSharedSegmentBaseModel();
    const normalizedHints = [];
    const seenHints = new Set();
    for (const rawWord of extraWords) {
      const normalized = normalizeSegmentWord(rawWord);
      if (normalized.length < 2 || seenHints.has(normalized)) {
        continue;
      }
      seenHints.add(normalized);
      normalizedHints.push(normalized);
    }

    if (normalizedHints.length === 0) {
      return baseModel;
    }

    const cacheKey = `extra::${normalizedHints.join("|")}`;
    const cached = segmentModelCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const hintLexicon = new Set();
    for (const word of normalizedHints) {
      if (!baseModel.exactLexicon.has(word)) {
        hintLexicon.add(word);
      }
    }

    const model = {
      cacheKey,
      exactLexicon: baseModel.exactLexicon,
      hintLexicon,
      bridgeWords: baseModel.bridgeWords,
      trigramModel: baseModel.trigramModel,
      domainWords: baseModel.domainWords,
    };
    segmentModelCache.set(cacheKey, model);
    return model;
  }

  function countSegmentVowels(word) {
    return (String(word || "").match(/[aeiouy]/g) || []).length;
  }

  function getMaxConsonantRun(word) {
    let longest = 0;
    let current = 0;
    for (const char of String(word || "")) {
      if (/[aeiouy]/.test(char)) {
        current = 0;
        continue;
      }
      current += 1;
      if (current > longest) {
        longest = current;
      }
    }
    return longest;
  }

  function getUnknownSegmentAssessment(word, model) {
    const cacheKey = `${model.trigramModel.floor}::${word}`;
    if (unknownSegmentWordCache.has(cacheKey)) {
      return unknownSegmentWordCache.get(cacheKey);
    }

    const normalized = String(word || "");
    const letters = normalized.length;
    if (letters < 4) {
      const rejected = {
        plausible: false,
        quality: 0,
        coverageWeight: 0,
        meaningfulWeight: 0,
        reward: Number.NEGATIVE_INFINITY,
      };
      // Sehr kurze Fragmente häufen sich im OOV-Pfad; wir halten den Cache deshalb begrenzt,
      // ohne bei jeder Spitze den kompletten Warmzustand für plausiblere Wörter zu verlieren.
      evictOldUnknownSegmentCacheEntries();
      unknownSegmentWordCache.set(cacheKey, rejected);
      return rejected;
    }

    const padded = `^${normalized}$`;
    let trigramSum = 0;
    let trigramCount = 0;
    let boundaryHits = 0;
    for (let index = 0; index <= padded.length - 3; index += 1) {
      const trigram = padded.slice(index, index + 3);
      const score = model.trigramModel.scores.get(trigram) ?? model.trigramModel.floor;
      trigramSum += score;
      trigramCount += 1;
      if (score > model.trigramModel.floor) {
        boundaryHits += 1;
      }
    }

    const averageTrigramScore =
      trigramCount > 0 ? trigramSum / trigramCount : model.trigramModel.floor;
    const trigramRange = Math.max(0.001, model.trigramModel.max - model.trigramModel.floor);
    const trigramLikelihood = clampNumber(
      (averageTrigramScore - model.trigramModel.floor) / trigramRange,
      0,
      1
    );
    const vowelRatio = countSegmentVowels(normalized) / letters;
    const vowelFitness = clampNumber(1 - Math.abs(0.42 - vowelRatio) / 0.28, 0, 1);
    let bigramHits = 0;
    for (let index = 0; index < normalized.length - 1; index += 1) {
      if (COMMON_SEGMENT_BIGRAMS.has(normalized.slice(index, index + 2))) {
        bigramHits += 1;
      }
    }
    const bigramRatio = normalized.length > 1 ? bigramHits / (normalized.length - 1) : 0;
    const maxConsonantRun = getMaxConsonantRun(normalized);
    const consonantFitness = clampNumber(1 - Math.max(0, maxConsonantRun - 3) * 0.28, 0, 1);
    const lengthPrior = clampNumber(
      0.55 +
        Math.min(0.35, Math.max(0, letters - 4) * 0.06) -
        Math.max(0, letters - 11) * 0.04,
      0.15,
      1
    );
    const boundaryFitness = clampNumber(boundaryHits / Math.max(1, trigramCount), 0, 1);

    let quality =
      trigramLikelihood * 0.43 +
      vowelFitness * 0.18 +
      bigramRatio * 0.18 +
      consonantFitness * 0.11 +
      lengthPrior * 0.07 +
      boundaryFitness * 0.03;

    if (vowelRatio < 0.18 || vowelRatio > 0.72) {
      quality -= 0.14;
    }
    if (maxConsonantRun >= 6) {
      quality -= 0.18;
    }
    if (bigramRatio < 0.18) {
      quality -= 0.12;
    }
    if (letters <= 5 && trigramLikelihood < 0.46) {
      quality -= 0.1;
    }

    quality = clampNumber(quality, 0, 1);
    const plausible =
      quality >= (letters >= 7 ? 0.55 : 0.6) &&
      vowelRatio >= 0.18 &&
      vowelRatio <= 0.72 &&
      bigramRatio >= 0.18 &&
      maxConsonantRun <= 6;

    const result = {
      plausible,
      quality,
      coverageWeight: clampNumber(0.36 + quality * 0.58, 0, 0.92),
      meaningfulWeight: clampNumber(0.14 + quality * 0.76, 0, 0.9),
      reward: plausible
        ? letters * (0.92 + quality * 1.55) + trigramLikelihood * 1.6 + bigramRatio * 0.8
        : Number.NEGATIVE_INFINITY,
    };
    // Plausible OOV-Treffer sind teurer zu berechnen; wir räumen deshalb nur gestaffelt aus,
    // damit häufig wiederkehrende Fachwörter nicht durch eine einzelne Lastspitze sofort verschwinden.
    evictOldUnknownSegmentCacheEntries();
    unknownSegmentWordCache.set(cacheKey, result);
    return result;
  }

  function createSegmentToken(kind, text, quality, reward, options) {
    const opts = options && typeof options === "object" ? options : {};
    return {
      kind,
      text,
      quality,
      reward,
      coverageWeight: Number.isFinite(opts.coverageWeight) ? opts.coverageWeight : 0,
      meaningfulWeight: Number.isFinite(opts.meaningfulWeight) ? opts.meaningfulWeight : 0,
      dpStrength: Number.isFinite(opts.dpStrength) ? opts.dpStrength : 0,
      isBridge: Boolean(opts.isBridge),
      isShortExact: Boolean(opts.isShortExact),
    };
  }

  function classifySegmentUnit(word, upperWord, model, allowUnknownWord = true) {
    if (!word || !model) {
      return null;
    }

    const isBridge = model.bridgeWords.has(word);
    // Kurze Exact-Wörter dürfen nur über eine Whitelist laufen, damit Split-Noise klein bleibt.
    const isShortExact = !isBridge && word.length === 3 && SHORT_EXACT_SEGMENT_WORDS.has(word);
    const isPrimaryExact = !isBridge && word.length >= 4;
    if (model.exactLexicon.has(word)) {
      if (!isBridge && !isPrimaryExact && !isShortExact) {
        return null;
      }
      const exactQuality = isBridge ? 0.36 : isShortExact ? 0.62 : 1;
      const rewardMultiplier = isBridge ? 0.48 : isShortExact ? 1.65 : 2.95;
      const reward =
        upperWord.length * rewardMultiplier +
        (!isBridge && !isShortExact && upperWord.length >= 6 ? 1.2 : 0);
      return createSegmentToken(
        isBridge ? "bridge" : "exact",
        upperWord,
        exactQuality,
        reward,
        {
          coverageWeight: isBridge ? 0.18 : isShortExact ? 0.55 : 1,
          meaningfulWeight: isBridge ? 0.06 : isShortExact ? 0.58 : 1,
          dpStrength: isBridge ? 0 : isShortExact ? upperWord.length * 0.55 : upperWord.length,
          isBridge,
          isShortExact,
        }
      );
    }

    if (model.hintLexicon.has(word)) {
      if (!isBridge && word.length < 4) {
        return null;
      }
      return createSegmentToken(
        isBridge ? "bridge" : "hint",
        upperWord,
        isBridge ? 0.4 : 0.92,
        upperWord.length * (isBridge ? 0.55 : 2.58) + 0.4,
        {
          coverageWeight: isBridge ? 0.22 : 0.94,
          meaningfulWeight: isBridge ? 0.08 : 0.9,
          dpStrength: isBridge ? 0 : upperWord.length * 0.9,
          isBridge,
        }
      );
    }

    if (word.length >= 5) {
      for (const rule of HARD_SEGMENT_SUFFIXES) {
        if (!word.endsWith(rule.suffix) || word.length - rule.suffix.length < rule.minStemLength) {
          continue;
        }
        const stem = word.slice(0, word.length - rule.suffix.length);
        if (model.bridgeWords.has(stem)) {
          continue;
        }
        if (!model.exactLexicon.has(stem) && !model.hintLexicon.has(stem)) {
          continue;
        }

        return createSegmentToken(
          "suffix_variant",
          upperWord,
          rule.quality,
          upperWord.length * (2.15 + rule.quality * 0.42) + (upperWord.length >= 6 ? 0.6 : 0),
          {
            coverageWeight: 0.88,
            meaningfulWeight: 0.82,
            dpStrength: upperWord.length * 0.8,
          }
        );
      }
    }

    if (!allowUnknownWord) {
      return null;
    }

    const unknownAssessment = getUnknownSegmentAssessment(word, model);
    if (!unknownAssessment.plausible) {
      return null;
    }

    return createSegmentToken(
      "unknown_word",
      upperWord,
      unknownAssessment.quality,
      unknownAssessment.reward,
      {
        coverageWeight: unknownAssessment.coverageWeight,
        meaningfulWeight: unknownAssessment.meaningfulWeight,
        dpStrength: upperWord.length * unknownAssessment.quality,
      }
    );
  }

  function isBetterSegmentState(candidate, current) {
    if (!current) {
      return true;
    }
    if (candidate.score !== current.score) {
      return candidate.score > current.score;
    }
    if (candidate.strongChars !== current.strongChars) {
      return candidate.strongChars > current.strongChars;
    }
    if (candidate.rawChars !== current.rawChars) {
      return candidate.rawChars < current.rawChars;
    }
    return candidate.tokens.length < current.tokens.length;
  }

  function appendRawUnknownToken(tokens, char) {
    const next = tokens.slice();
    const last = next[next.length - 1] || null;
    if (last && last.kind === "raw_unknown") {
      next[next.length - 1] = createSegmentToken("raw_unknown", last.text + char, 0, last.reward - 1.35, {
        coverageWeight: 0,
        meaningfulWeight: 0,
        dpStrength: 0,
      });
      return next;
    }

    next.push(
      createSegmentToken("raw_unknown", char, 0, -1.35, {
        coverageWeight: 0,
        meaningfulWeight: 0,
        dpStrength: 0,
      })
    );
    return next;
  }

  function appendSegmentToken(tokens, token) {
    return tokens.concat(token);
  }

  function getSegmentSupportStrength(token) {
    if (!token || token.kind === "raw_unknown") {
      return 0;
    }
    if (token.isShortExact) {
      // Short-Exact-Wörter stützen Brücken sonst zu schwach; die Whitelist begrenzt den Effekt.
      return clampNumber(token.quality * 1.15, 0, 1);
    }
    if (token.kind === "unknown_word") {
      const lengthFactor = token.text.length >= 8 ? 1 : token.text.length >= 6 ? 0.88 : 0.74;
      return token.quality >= 0.58 ? token.quality * lengthFactor : 0;
    }
    if (token.isBridge) {
      return 0;
    }
    const lengthFactor =
      token.text.length <= 3 ? 0.28 : token.text.length === 4 ? 0.62 : token.text.length === 5 ? 0.84 : 1;
    return token.quality * lengthFactor;
  }

  function isSupportedBridgeToken(tokens, index) {
    const token = tokens[index];
    if (!token || !token.isBridge) {
      return false;
    }
    const left = tokens[index - 1] || null;
    const right = tokens[index + 1] || null;
    return (
      getSegmentSupportStrength(left) >= BRIDGE_SUPPORT_THRESHOLD &&
      getSegmentSupportStrength(right) >= BRIDGE_SUPPORT_THRESHOLD
    );
  }

  function isWeakBoundary(tokens, leftIndex) {
    const left = tokens[leftIndex] || null;
    const right = tokens[leftIndex + 1] || null;
    if (!left || !right) {
      return false;
    }

    const leftSupportedBridge = left.isBridge && isSupportedBridgeToken(tokens, leftIndex);
    const rightSupportedBridge = right.isBridge && isSupportedBridgeToken(tokens, leftIndex + 1);
    if ((left.isBridge && !leftSupportedBridge) || (right.isBridge && !rightSupportedBridge)) {
      return true;
    }

    const leftSupport = leftSupportedBridge ? BRIDGE_SUPPORT_THRESHOLD : getSegmentSupportStrength(left);
    const rightSupport = rightSupportedBridge ? BRIDGE_SUPPORT_THRESHOLD : getSegmentSupportStrength(right);
    if (leftSupport < WEAK_BOUNDARY_SUPPORT_THRESHOLD || rightSupport < WEAK_BOUNDARY_SUPPORT_THRESHOLD) {
      return true;
    }

    const leftShort = !left.isBridge && left.text.length <= 4;
    const rightShort = !right.isBridge && right.text.length <= 4;
    return leftShort && rightShort;
  }

  function computeSegmentQualityScore(metrics) {
    if (!metrics) {
      return -Infinity;
    }
    return (
      metrics.confidence * 12 +
      metrics.coverage * 5.8 +
      metrics.meaningfulTokenRatio * 4.9 +
      metrics.strongSegmentRatio * 2.8 +
      metrics.averageTokenScore * 1.7 +
      metrics.lexiconCoverage * 4.8 +
      metrics.plausibleOovRatio * 1.25 +
      metrics.supportedBridgeRatio * 1.1 -
      metrics.unknownRatio * 4.9 -
      metrics.boundaryCount * 0.62 -
      metrics.weakBoundaryCount * 1.45 -
      metrics.unsupportedBridgeCount * 1.85 -
      metrics.shortTokenCount * 0.95
    );
  }

  function evaluateSegmentedTokens(tokens, totalLetters) {
    let coveredLetters = 0;
    let meaningfulLetters = 0;
    let unknownLetters = 0;
    let qualityLetters = 0;
    let plausibleOovLetters = 0;
    let supportedBridgeLetters = 0;
    let strongSegmentLetters = 0;
    let lexiconLetters = 0;
    let unsupportedBridgeCount = 0;
    let shortTokenCount = 0;

    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      const tokenLength = token.text.length;
      qualityLetters += tokenLength * clampNumber(token.quality, 0, 1);

      if (token.kind === "raw_unknown") {
        unknownLetters += tokenLength;
        continue;
      }

      if (token.isBridge) {
        const bridgeSupported = isSupportedBridgeToken(tokens, index);
        coveredLetters += tokenLength * (bridgeSupported ? 0.78 : 0.16);
        meaningfulLetters += tokenLength * (bridgeSupported ? 0.9 : 0.02);
        unknownLetters += tokenLength * (bridgeSupported ? 0.1 : 0.88);
        if (tokenLength < 4 && !bridgeSupported) {
          shortTokenCount += 1;
        }
        if (bridgeSupported) {
          supportedBridgeLetters += tokenLength;
          lexiconLetters += tokenLength * 0.55;
        } else {
          unsupportedBridgeCount += 1;
        }
        continue;
      }

      if (tokenLength < 4) {
        shortTokenCount += 1;
      }
      coveredLetters += tokenLength * token.coverageWeight;
      meaningfulLetters += tokenLength * token.meaningfulWeight;
      if (token.kind === "unknown_word") {
        unknownLetters += tokenLength * clampNumber(0.82 - token.coverageWeight, 0.12, 0.7);
        plausibleOovLetters += tokenLength;
      } else if (token.kind === "suffix_variant") {
        unknownLetters += tokenLength * 0.16;
        lexiconLetters += tokenLength * 0.84;
      } else if (token.kind === "hint") {
        unknownLetters += tokenLength * 0.08;
        lexiconLetters += tokenLength * 0.92;
      } else {
        lexiconLetters += tokenLength;
      }

      if (getSegmentSupportStrength(token) >= 0.68) {
        strongSegmentLetters += tokenLength;
      }
    }

    let weakBoundaryCount = 0;
    const boundaryCount = Math.max(0, tokens.length - 1);
    for (let index = 0; index < boundaryCount; index += 1) {
      if (isWeakBoundary(tokens, index)) {
        weakBoundaryCount += 1;
      }
    }

    const safeLetters = Math.max(1, totalLetters);
    const coverage = clampNumber(coveredLetters / safeLetters, 0, 1);
    const meaningfulTokenRatio = clampNumber(meaningfulLetters / safeLetters, 0, 1);
    const unknownRatio = clampNumber(unknownLetters / safeLetters, 0, 1);
    const averageTokenScore = clampNumber(qualityLetters / safeLetters, 0, 1);
    const plausibleOovRatio = clampNumber(plausibleOovLetters / safeLetters, 0, 1);
    const supportedBridgeRatio = clampNumber(supportedBridgeLetters / safeLetters, 0, 1);
    const strongSegmentRatio = clampNumber(strongSegmentLetters / safeLetters, 0, 1);
    const lexiconCoverage = clampNumber(lexiconLetters / safeLetters, 0, 1);
    const tokenCount = tokens.length;
    const boundaryPenaltyRatio = clampNumber(
      (boundaryCount * 0.08 +
        weakBoundaryCount * 0.17 +
        unsupportedBridgeCount * 0.21 +
        shortTokenCount * 0.09) /
        Math.max(1, tokenCount + 1),
      0,
      0.62
    );
    const confidence = clampNumber(
      coverage * 0.36 +
        meaningfulTokenRatio * 0.27 +
        (1 - unknownRatio) * 0.16 +
        averageTokenScore * 0.08 +
        strongSegmentRatio * 0.07 +
        lexiconCoverage * 0.06 +
        supportedBridgeRatio * 0.04 -
        boundaryPenaltyRatio,
      0,
      1
    );
    const qualityScore = computeSegmentQualityScore({
      coverage,
      meaningfulTokenRatio,
      unknownRatio,
      averageTokenScore,
      plausibleOovRatio,
      supportedBridgeRatio,
      strongSegmentRatio,
      lexiconCoverage,
      confidence,
      boundaryCount,
      weakBoundaryCount,
      unsupportedBridgeCount,
      shortTokenCount,
    });

    return {
      tokenCount,
      coveredLetters,
      meaningfulLetters,
      unknownLetters,
      qualityLetters,
      plausibleOovLetters,
      supportedBridgeLetters,
      strongSegmentLetters,
      lexiconLetters,
      coverage,
      meaningfulTokenRatio,
      unknownRatio,
      averageTokenScore,
      plausibleOovRatio,
      supportedBridgeRatio,
      strongSegmentRatio,
      lexiconCoverage,
      boundaryCount,
      weakBoundaryCount,
      unsupportedBridgeCount,
      shortTokenCount,
      qualityScore,
      confidence,
    };
  }

  function shouldAdoptReplacementSegmentation(currentMetrics, replacementMetrics, options) {
    if (!currentMetrics || !replacementMetrics) {
      return false;
    }

    const opts = options && typeof options === "object" ? options : {};
    const gain = replacementMetrics.qualityScore - currentMetrics.qualityScore;
    let threshold = Number.isFinite(opts.baseThreshold) ? Number(opts.baseThreshold) : 0.88;
    const extraBoundaries = Math.max(0, replacementMetrics.boundaryCount - currentMetrics.boundaryCount);
    const extraShortTokens = Math.max(0, replacementMetrics.shortTokenCount - currentMetrics.shortTokenCount);
    const extraWeakBoundaries = Math.max(
      0,
      replacementMetrics.weakBoundaryCount - currentMetrics.weakBoundaryCount
    );
    const extraUnsupportedBridges = Math.max(
      0,
      replacementMetrics.unsupportedBridgeCount - currentMetrics.unsupportedBridgeCount
    );

    threshold += extraBoundaries * 0.48;
    threshold += extraShortTokens * 0.72;
    threshold += extraWeakBoundaries * 0.95;
    threshold += extraUnsupportedBridges * 1.45;
    const lexiconGain = replacementMetrics.lexiconCoverage - currentMetrics.lexiconCoverage;
    if (lexiconGain >= 0.35) {
      threshold -= 0.95;
    }
    if (lexiconGain >= 0.6) {
      threshold -= 0.55;
    }
    if (replacementMetrics.lexiconCoverage >= 0.75 && replacementMetrics.weakBoundaryCount === 0) {
      threshold -= 1.35;
    }
    if (replacementMetrics.supportedBridgeRatio >= 0.12) {
      threshold -= 0.42;
    }

    if (
      opts.preferConservative &&
      Number.isFinite(opts.rawLength) &&
      opts.rawLength >= 12 &&
      currentMetrics.plausibleOovRatio >= 0.62 &&
      (replacementMetrics.boundaryCount >= 2 ||
        replacementMetrics.shortTokenCount > 0 ||
        replacementMetrics.unsupportedBridgeCount > 0)
    ) {
      // Lange plausible OOV-Läufe bleiben defaultmäßig zusammen, solange ein Split
      // keinen klaren Qualitätsvorsprung zeigt. Das verhindert "MACH ZEHN DER ..." als UI-Artefakt.
      threshold += 0.82;
    }

    if (replacementMetrics.unsupportedBridgeCount > currentMetrics.unsupportedBridgeCount) {
      return false;
    }
    if (
      replacementMetrics.strongSegmentRatio + 0.16 < currentMetrics.strongSegmentRatio &&
      replacementMetrics.lexiconCoverage <= currentMetrics.lexiconCoverage + 0.2
    ) {
      return false;
    }
    if (replacementMetrics.lexiconCoverage + 0.05 < currentMetrics.lexiconCoverage) {
      return false;
    }

    return gain > threshold;
  }

  function createRawRunToken(text, model) {
    const classified = classifySegmentUnit(String(text || "").toLowerCase(), String(text || ""), model);
    if (classified && !classified.isBridge) {
      return classified;
    }
    return createSegmentToken("raw_unknown", text, 0, -String(text || "").length * 1.35, {
      coverageWeight: 0,
      meaningfulWeight: 0,
      dpStrength: 0,
    });
  }

  function splitLongOovToken(token, model) {
    const text = token.text;
    if (text.length < 8) {
      return null;
    }
    if (
      token.kind === "exact" &&
      model &&
      model.domainWords &&
      model.domainWords.has(text.toLowerCase())
    ) {
      // Domain-Exact-Wörter sollen nicht weiter aufgebrochen werden, damit Fachbegriffe stabil bleiben.
      return null;
    }

    const baselineToken =
      token && token.kind === "raw_unknown" ? createRawRunToken(text, model) : token || createRawRunToken(text, model);
    const baselineMetrics = evaluateSegmentedTokens([baselineToken], text.length);
    let best = null;
    const minPartLength = 2;
    const maxPartLength = Math.min(16, text.length - minPartLength);

    function testParts(parts) {
      const descriptors = [];

      for (const part of parts) {
        const descriptor = classifySegmentUnit(part.toLowerCase(), part, model);
        if (!descriptor || descriptor.kind === "raw_unknown") {
          return;
        }

        descriptors.push(descriptor);
      }

      if (descriptors.every((descriptor) => descriptor.isBridge)) {
        return;
      }

      const replacementMetrics = evaluateSegmentedTokens(descriptors, text.length);
      if (
        !shouldAdoptReplacementSegmentation(baselineMetrics, replacementMetrics, {
          baseThreshold: 0.52,
          preferConservative: true,
          rawLength: text.length,
        })
      ) {
        return;
      }

      if (!best || replacementMetrics.qualityScore > best.metrics.qualityScore) {
        best = {
          metrics: replacementMetrics,
          descriptors,
        };
      }
    }

    for (let splitA = minPartLength; splitA <= maxPartLength; splitA += 1) {
      const left = text.slice(0, splitA);
      const right = text.slice(splitA);
      if (right.length >= minPartLength) {
        testParts([left, right]);
      }

      for (
        let splitB = splitA + minPartLength;
        splitB <= Math.min(text.length - minPartLength, splitA + maxPartLength);
        splitB += 1
      ) {
        const mid = text.slice(splitA, splitB);
        const tail = text.slice(splitB);
        if (tail.length < minPartLength) {
          continue;
        }
        testParts([left, mid, tail]);
      }
    }

    if (!best) {
      return null;
    }
    return best.descriptors;
  }

  function shouldRefineSegmentWindow(tokens) {
    if (!Array.isArray(tokens) || tokens.length < 2) {
      return false;
    }
    return tokens.some(
      (token) =>
        token.isBridge ||
        token.kind === "unknown_word" ||
        token.kind === "raw_unknown" ||
        (token.kind === "exact" && token.text.length <= 4) ||
        token.kind === "suffix_variant"
    );
  }

  function refineExactCompoundJoins(tokens, model) {
    const refined = tokens.slice();

    for (let index = 0; index < refined.length - 1; index += 1) {
      const combinedText = refined[index].text + refined[index + 1].text;
      const domainWords =
        model && model.domainWords ? model.domainWords : getNormalizedDomainWords();
      const isDomainCompound =
        combinedText.length >= 8 &&
        domainWords &&
        domainWords.has(combinedText.toLowerCase());
      let combinedToken = classifySegmentUnit(
        combinedText.toLowerCase(),
        combinedText,
        model,
        false
      );
      if ((!combinedToken || combinedToken.isBridge) && isDomainCompound) {
        combinedToken = createSegmentToken(
          "exact",
          combinedText,
          1,
          combinedText.length * 2.95 + (combinedText.length >= 6 ? 1.2 : 0),
          {
            coverageWeight: 1,
            meaningfulWeight: 1,
            dpStrength: combinedText.length,
          }
        );
      }
      if (!combinedToken || combinedToken.isBridge) {
        continue;
      }
      if (
        combinedToken.kind !== "exact" &&
        combinedToken.kind !== "hint" &&
        combinedToken.kind !== "suffix_variant"
      ) {
        continue;
      }

      const currentScore =
        (Number.isFinite(refined[index].reward) ? refined[index].reward : 0) +
        (Number.isFinite(refined[index + 1].reward) ? refined[index + 1].reward : 0);
      const candidateScore = (Number.isFinite(combinedToken.reward) ? combinedToken.reward : 0) + 1.2;
      const isExactDomainCompound =
        combinedToken.kind === "exact" && isDomainCompound;
      // Lange exakte Komposita sollen schneller zusammengezogen werden, damit klare Fachwörter stabil bleiben.
      const minGain = combinedToken.kind === "exact" && combinedText.length >= 8 ? 0.15 : 0.6;
      if (candidateScore > currentScore + minGain || isExactDomainCompound) {
        refined.splice(index, 2, combinedToken);
        index = Math.max(-1, index - 2);
      }
    }

    return refined;
  }

  function hasBridgeContext(tokens, leftIndex, rightIndex) {
    const left = leftIndex >= 0 ? tokens[leftIndex] : null;
    const right = rightIndex < tokens.length ? tokens[rightIndex] : null;
    const leftSupport = left ? getSegmentSupportStrength(left) : BRIDGE_SUPPORT_THRESHOLD;
    const rightSupport = right ? getSegmentSupportStrength(right) : BRIDGE_SUPPORT_THRESHOLD;
    return leftSupport >= BRIDGE_SUPPORT_THRESHOLD && rightSupport >= BRIDGE_SUPPORT_THRESHOLD;
  }

  function refineSingleTokenBridgeSplits(tokens, model) {
    const refined = tokens.slice();

    for (let index = 0; index < refined.length; index += 1) {
      const token = refined[index];
      if (!token || token.isBridge || token.text.length < 5) {
        continue;
      }

      const currentScore = Number.isFinite(token.reward) ? token.reward : 0;
      for (const bridgeWord of SHORT_BRIDGE_SEGMENT_WORDS) {
        const bridgeText = bridgeWord.toUpperCase();

        if (token.text.startsWith(bridgeText)) {
          const remainderText = token.text.slice(bridgeText.length);
          if (remainderText.length >= 2) {
            const bridgeToken = classifySegmentUnit(bridgeWord, bridgeText, model);
            const rightToken = classifySegmentUnit(remainderText.toLowerCase(), remainderText, model);
            const bridgeChainSupported =
              rightToken &&
              rightToken.isBridge &&
              hasBridgeContext(refined, index - 1, index + 1);
            const leftSupport = getSegmentSupportStrength(refined[index - 1]);
            const rightSupport = rightToken ? getSegmentSupportStrength(rightToken) : 0;
            // Bridge-Splits dürfen greifen, wenn beide Seiten stark genug sind, auch falls der Alt-Kontext schwach war.
            const strongNeighborPair =
              leftSupport >= BRIDGE_SUPPORT_THRESHOLD && rightSupport >= BRIDGE_SUPPORT_THRESHOLD;
            if (
              bridgeToken &&
              bridgeToken.isBridge &&
              rightToken &&
              (rightSupport >= BRIDGE_SUPPORT_THRESHOLD || bridgeChainSupported) &&
              (hasBridgeContext(refined, index - 1, rightToken.isBridge ? index + 1 : index) ||
                strongNeighborPair)
            ) {
              const candidateScore =
                (Number.isFinite(bridgeToken.reward) ? bridgeToken.reward : 0) +
                (Number.isFinite(rightToken.reward) ? rightToken.reward : 0) +
                bridgeText.length * 3;
              if (candidateScore > currentScore + 1) {
                refined.splice(index, 1, bridgeToken, rightToken);
                break;
              }
            }
          }
        }

        if (token.text.endsWith(bridgeText)) {
          const leadingText = token.text.slice(0, token.text.length - bridgeText.length);
          if (leadingText.length >= 2) {
            const leftToken = classifySegmentUnit(leadingText.toLowerCase(), leadingText, model);
            const bridgeToken = classifySegmentUnit(bridgeWord, bridgeText, model);
            const bridgeChainSupported =
              leftToken &&
              leftToken.isBridge &&
              hasBridgeContext(refined, index - 1, index + 1);
            const leftSupport = leftToken ? getSegmentSupportStrength(leftToken) : 0;
            const rightSupport = getSegmentSupportStrength(refined[index + 1]);
            // Bridge-Splits dürfen greifen, wenn beide Seiten stark genug sind, auch falls der Alt-Kontext schwach war.
            const strongNeighborPair =
              leftSupport >= BRIDGE_SUPPORT_THRESHOLD && rightSupport >= BRIDGE_SUPPORT_THRESHOLD;
            if (
              leftToken &&
              bridgeToken &&
              bridgeToken.isBridge &&
              (leftSupport >= BRIDGE_SUPPORT_THRESHOLD || bridgeChainSupported) &&
              (hasBridgeContext(refined, leftToken.isBridge ? index - 1 : index, index + 1) ||
                strongNeighborPair)
            ) {
              const candidateScore =
                (Number.isFinite(leftToken.reward) ? leftToken.reward : 0) +
                (Number.isFinite(bridgeToken.reward) ? bridgeToken.reward : 0) +
                bridgeText.length * 3;
              if (candidateScore > currentScore + 1) {
                refined.splice(index, 1, leftToken, bridgeToken);
                break;
              }
            }
          }
        }
      }
    }

    return refined;
  }

  function refineBridgeContinuations(tokens, model) {
    const refined = tokens.slice();

    for (let index = 0; index < refined.length - 1; index += 1) {
      const combinedText = refined[index].text + refined[index + 1].text;
      for (const bridgeWord of SHORT_BRIDGE_SEGMENT_WORDS) {
        const bridgeText = bridgeWord.toUpperCase();
        const currentScore =
          (Number.isFinite(refined[index].reward) ? refined[index].reward : 0) +
          (Number.isFinite(refined[index + 1].reward) ? refined[index + 1].reward : 0);

        if (combinedText.startsWith(bridgeText)) {
          const remainderText = combinedText.slice(bridgeText.length);
          if (remainderText.length >= 2) {
            const bridgeToken = classifySegmentUnit(bridgeWord, bridgeText, model);
            const rightToken = classifySegmentUnit(remainderText.toLowerCase(), remainderText, model);
            const bridgeChainSupported =
              rightToken &&
              rightToken.isBridge &&
              hasBridgeContext(refined, index - 1, index + 2);
            if (
              bridgeToken &&
              bridgeToken.isBridge &&
              rightToken &&
              (getSegmentSupportStrength(rightToken) >= BRIDGE_SUPPORT_THRESHOLD ||
                bridgeChainSupported) &&
              hasBridgeContext(refined, index - 1, rightToken.isBridge ? index + 2 : index + 1)
            ) {
              const candidateScore =
                (Number.isFinite(bridgeToken.reward) ? bridgeToken.reward : 0) +
                (Number.isFinite(rightToken.reward) ? rightToken.reward : 0) +
                bridgeText.length * 3;
              if (candidateScore > currentScore + 1) {
                refined.splice(index, 2, bridgeToken, rightToken);
                break;
              }
            }
          }
        }

        if (combinedText.endsWith(bridgeText)) {
          const leadingText = combinedText.slice(0, combinedText.length - bridgeText.length);
          if (leadingText.length >= 2) {
            const leftToken = classifySegmentUnit(leadingText.toLowerCase(), leadingText, model);
            const bridgeToken = classifySegmentUnit(bridgeWord, bridgeText, model);
            const bridgeChainSupported =
              leftToken &&
              leftToken.isBridge &&
              hasBridgeContext(refined, index - 1, index + 2);
            if (
              leftToken &&
              bridgeToken &&
              bridgeToken.isBridge &&
              (getSegmentSupportStrength(leftToken) >= BRIDGE_SUPPORT_THRESHOLD ||
                bridgeChainSupported) &&
              hasBridgeContext(refined, leftToken.isBridge ? index - 1 : index, index + 2)
            ) {
              const candidateScore =
                (Number.isFinite(leftToken.reward) ? leftToken.reward : 0) +
                (Number.isFinite(bridgeToken.reward) ? bridgeToken.reward : 0) +
                bridgeText.length * 3;
              if (candidateScore > currentScore + 1) {
                refined.splice(index, 2, leftToken, bridgeToken);
                break;
              }
            }
          }
        }
      }
    }

    return refined;
  }

  function refineSegmentedTokens(tokens, model) {
    const refined = refineBridgeContinuations(
      refineExactCompoundJoins(refineSingleTokenBridgeSplits(tokens, model), model),
      model
    );
    const domainWords =
      model && model.domainWords ? model.domainWords : getNormalizedDomainWords();
    let changed = true;
    let guard = 0;

    while (changed && guard < 4) {
      changed = false;
      guard += 1;

      outer: for (let windowSize = 2; windowSize <= 3; windowSize += 1) {
        for (let index = 0; index <= refined.length - windowSize; index += 1) {
          const windowTokens = refined.slice(index, index + windowSize);
          if (!shouldRefineSegmentWindow(windowTokens)) {
            continue;
          }
          if (
            domainWords &&
            windowTokens.some(
              (token) =>
                token &&
                token.kind === "exact" &&
                token.text.length >= 8 &&
                domainWords.has(token.text.toLowerCase())
            )
          ) {
            // Domain-Exact-Wörter sollen bei der Fenster-Nachsplit-Phase stabil bleiben.
            continue;
          }

          const combinedText = windowTokens.map((token) => token.text).join("");
          if (combinedText.length < 7) {
            continue;
          }

          const replacement = splitLongOovToken(
            createSegmentToken("raw_unknown", combinedText, 0, -combinedText.length * 1.35, {
              coverageWeight: 0,
              meaningfulWeight: 0,
              dpStrength: 0,
            }),
            model
          );
          if (!replacement || replacement.length === 0) {
            continue;
          }

          const sameTokens =
            replacement.length === windowTokens.length &&
            replacement.every((token, replacementIndex) => token.text === windowTokens[replacementIndex].text);
          if (sameTokens) {
            continue;
          }

          const currentMetrics = evaluateSegmentedTokens(windowTokens, combinedText.length);
          const replacementMetrics = evaluateSegmentedTokens(replacement, combinedText.length);
          if (
            shouldAdoptReplacementSegmentation(currentMetrics, replacementMetrics, {
              baseThreshold: 0.94,
              preferConservative: true,
              rawLength: combinedText.length,
            })
          ) {
            refined.splice(index, windowSize, ...replacement);
            changed = true;
            break outer;
          }
        }
      }
    }

    return refined;
  }

  function applyLongOovSplitPhase(tokens, model) {
    const next = [];
    for (const token of tokens) {
      if (
        !token.isBridge &&
        token.text.length >= 6 &&
        (token.kind === "raw_unknown" ||
          token.kind === "unknown_word" ||
          token.kind === "exact" ||
          token.kind === "hint")
      ) {
        const split = splitLongOovToken(token, model);
        if (split && split.length > 1) {
          next.push(...split);
          continue;
        }
      }
      next.push(token);
    }
    return next;
  }

  function getSplitPenaltyForUnit(existingTokens, unit) {
    if (!Array.isArray(existingTokens) || existingTokens.length === 0) {
      return 0;
    }

    let penalty = unit.isBridge ? 0.95 : 0.62;
    if (unit.text.length < 4) {
      penalty += 0.85;
    } else if (unit.text.length === 4) {
      penalty += 0.34;
    }
    if (unit.kind === "unknown_word" && unit.text.length < 7) {
      penalty += 0.42;
    }
    if (unit.kind === "suffix_variant" && unit.text.length <= 5) {
      penalty += 0.24;
    }
    return penalty;
  }

  function segmentUppercaseRun(runUpper, model, maxWordLength) {
    const run = String(runUpper || "");
    if (!run) {
      return {
        rawText: "",
        segmentedTokens: [],
        rawTokens: [],
        segmentedMetrics: evaluateSegmentedTokens([], 0),
        rawMetrics: evaluateSegmentedTokens([], 0),
      };
    }

    const lowerRun = run.toLowerCase();
    const bestByIndex = Array(run.length + 1).fill(null);
    bestByIndex[0] = {
      score: 0,
      strongChars: 0,
      rawChars: 0,
      tokens: [],
    };

    for (let start = 0; start < run.length; start += 1) {
      const state = bestByIndex[start];
      if (!state) {
        continue;
      }

      const rawUnknownCandidate = {
        score: state.score - 1.35,
        strongChars: state.strongChars,
        rawChars: state.rawChars + 1,
        tokens: appendRawUnknownToken(state.tokens, run[start]),
      };
      if (isBetterSegmentState(rawUnknownCandidate, bestByIndex[start + 1])) {
        bestByIndex[start + 1] = rawUnknownCandidate;
      }

      const maxEnd = Math.min(run.length, start + Math.min(maxWordLength, 24));
      for (let end = start + 2; end <= maxEnd; end += 1) {
        const lowerWord = lowerRun.slice(start, end);
        const upperWord = run.slice(start, end);
        const unit = classifySegmentUnit(lowerWord, upperWord, model, end - start <= 12);
        if (!unit) {
          continue;
        }

        const splitPenalty = getSplitPenaltyForUnit(state.tokens, unit);
        const candidate = {
          score: state.score + unit.reward - splitPenalty,
          strongChars: state.strongChars + unit.dpStrength,
          rawChars: state.rawChars,
          tokens: appendSegmentToken(state.tokens, unit),
        };

        if (isBetterSegmentState(candidate, bestByIndex[end])) {
          bestByIndex[end] = candidate;
        }
      }
    }

    const best = bestByIndex[run.length] || {
      score: Number.NEGATIVE_INFINITY,
      strongChars: 0,
      rawChars: run.length,
      tokens: [
        createSegmentToken("raw_unknown", run, 0, -run.length * 1.35, {
          coverageWeight: 0,
          meaningfulWeight: 0,
          dpStrength: 0,
        }),
      ],
    };

    const longSplitTokens = applyLongOovSplitPhase(best.tokens, model);
    const refinedTokens = refineSegmentedTokens(longSplitTokens, model);
    const rawToken = createRawRunToken(run, model);
    const rawTokens = rawToken ? [rawToken] : [];

    return {
      rawText: run,
      segmentedTokens: refinedTokens,
      rawTokens,
      segmentedMetrics: evaluateSegmentedTokens(refinedTokens, run.length),
      rawMetrics: evaluateSegmentedTokens(rawTokens, run.length),
    };
  }

  function buildAggregatedMetricsFromRuns(runMetrics, totalLetters) {
    const aggregate = {
      tokenCount: 0,
      coveredLetters: 0,
      meaningfulLetters: 0,
      unknownLetters: 0,
      qualityLetters: 0,
      plausibleOovLetters: 0,
      supportedBridgeLetters: 0,
      strongSegmentLetters: 0,
      lexiconLetters: 0,
      boundaryCount: 0,
      weakBoundaryCount: 0,
      unsupportedBridgeCount: 0,
      shortTokenCount: 0,
    };

    for (const metrics of runMetrics) {
      aggregate.tokenCount += Number(metrics.tokenCount) || 0;
      aggregate.coveredLetters += Number(metrics.coveredLetters) || 0;
      aggregate.meaningfulLetters += Number(metrics.meaningfulLetters) || 0;
      aggregate.unknownLetters += Number(metrics.unknownLetters) || 0;
      aggregate.qualityLetters += Number(metrics.qualityLetters) || 0;
      aggregate.plausibleOovLetters += Number(metrics.plausibleOovLetters) || 0;
      aggregate.supportedBridgeLetters += Number(metrics.supportedBridgeLetters) || 0;
      aggregate.strongSegmentLetters += Number(metrics.strongSegmentLetters) || 0;
      aggregate.lexiconLetters += Number(metrics.lexiconLetters) || 0;
      aggregate.boundaryCount += Number(metrics.boundaryCount) || 0;
      aggregate.weakBoundaryCount += Number(metrics.weakBoundaryCount) || 0;
      aggregate.unsupportedBridgeCount += Number(metrics.unsupportedBridgeCount) || 0;
      aggregate.shortTokenCount += Number(metrics.shortTokenCount) || 0;
    }

    const safeLetters = Math.max(1, totalLetters);
    const coverage = clampNumber(aggregate.coveredLetters / safeLetters, 0, 1);
    const meaningfulTokenRatio = clampNumber(aggregate.meaningfulLetters / safeLetters, 0, 1);
    const unknownRatio = clampNumber(aggregate.unknownLetters / safeLetters, 0, 1);
    const averageTokenScore = clampNumber(aggregate.qualityLetters / safeLetters, 0, 1);
    const plausibleOovRatio = clampNumber(aggregate.plausibleOovLetters / safeLetters, 0, 1);
    const supportedBridgeRatio = clampNumber(aggregate.supportedBridgeLetters / safeLetters, 0, 1);
    const strongSegmentRatio = clampNumber(aggregate.strongSegmentLetters / safeLetters, 0, 1);
    const lexiconCoverage = clampNumber(aggregate.lexiconLetters / safeLetters, 0, 1);
    const boundaryPenaltyRatio = clampNumber(
      (aggregate.boundaryCount * 0.08 +
        aggregate.weakBoundaryCount * 0.17 +
        aggregate.unsupportedBridgeCount * 0.21 +
        aggregate.shortTokenCount * 0.09) /
        Math.max(1, aggregate.tokenCount + 1),
      0,
      0.62
    );
    const confidence = clampNumber(
      coverage * 0.36 +
        meaningfulTokenRatio * 0.27 +
        (1 - unknownRatio) * 0.16 +
        averageTokenScore * 0.08 +
        strongSegmentRatio * 0.07 +
        lexiconCoverage * 0.06 +
        supportedBridgeRatio * 0.04 -
        boundaryPenaltyRatio,
      0,
      1
    );
    const qualityScore = computeSegmentQualityScore({
      coverage,
      meaningfulTokenRatio,
      unknownRatio,
      averageTokenScore,
      plausibleOovRatio,
      supportedBridgeRatio,
      strongSegmentRatio,
      lexiconCoverage,
      confidence,
      boundaryCount: aggregate.boundaryCount,
      weakBoundaryCount: aggregate.weakBoundaryCount,
      unsupportedBridgeCount: aggregate.unsupportedBridgeCount,
      shortTokenCount: aggregate.shortTokenCount,
    });

    return {
      ...aggregate,
      coverage,
      meaningfulTokenRatio,
      unknownRatio,
      averageTokenScore,
      plausibleOovRatio,
      supportedBridgeRatio,
      strongSegmentRatio,
      lexiconCoverage,
      confidence,
      qualityScore,
    };
  }

  function chooseRunTokensForDisplay(runResult) {
    const segmentedMetrics = runResult.segmentedMetrics;
    const rawMetrics = runResult.rawMetrics;
    let scoreTokens = runResult.rawTokens;
    let scoreMetrics = rawMetrics;

    const segmentedPreferred = shouldAdoptReplacementSegmentation(rawMetrics, segmentedMetrics, {
      baseThreshold: 0.9,
      preferConservative: true,
      rawLength: runResult.rawText.length,
    });
    if (segmentedPreferred) {
      scoreTokens = runResult.segmentedTokens;
      scoreMetrics = segmentedMetrics;
    }

    if (scoreMetrics.weakBoundaryCount > 0 || scoreMetrics.unsupportedBridgeCount > 0) {
      const clearGain = segmentedMetrics.qualityScore - rawMetrics.qualityScore;
      if (!segmentedPreferred || clearGain < 1.6) {
        scoreTokens = runResult.rawTokens;
        scoreMetrics = rawMetrics;
      }
    }

    const weakDisplayBoundaries =
      scoreMetrics.weakBoundaryCount > 0 || scoreMetrics.unsupportedBridgeCount > 0;
    const displayTokens = weakDisplayBoundaries ? runResult.rawTokens : scoreTokens;

    return {
      scoreTokens,
      scoreMetrics,
      displayTokens,
    };
  }

  function mergeDomainDisplayTokenTexts(tokenTexts, model) {
    if (!Array.isArray(tokenTexts) || tokenTexts.length === 0) {
      return tokenTexts;
    }
    const domainWords = model && model.domainWords ? model.domainWords : getNormalizedDomainWords();
    if (!domainWords || domainWords.size === 0) {
      return tokenTexts;
    }

    let working = tokenTexts.slice();
    for (let guard = 0; guard < 4; guard += 1) {
      let changed = false;
      const nextTokens = [];
      for (const token of working) {
        const current = String(token || "");
        const lowerCurrent = current.toLowerCase();
        let splitApplied = false;

        for (const bridgeWord of SHORT_BRIDGE_SEGMENT_WORDS) {
          const bridgeIndex = lowerCurrent.indexOf(bridgeWord);
          if (bridgeIndex <= 0 || bridgeIndex >= lowerCurrent.length - bridgeWord.length) {
            continue;
          }
          const prefix = lowerCurrent.slice(0, bridgeIndex);
          const suffix = lowerCurrent.slice(bridgeIndex + bridgeWord.length);
          if (prefix.length >= 4 && domainWords.has(prefix)) {
            // Domain-Präfix + Brücke darf sichtbar getrennt werden; der Rest wird erneut geprüft.
            nextTokens.push(current.slice(0, bridgeIndex));
            nextTokens.push(bridgeWord.toUpperCase());
            nextTokens.push(current.slice(bridgeIndex + bridgeWord.length));
            splitApplied = true;
            break;
          }
        }

        if (!splitApplied) {
          for (const shortExact of SHORT_EXACT_SEGMENT_WORDS) {
            for (const bridgeWord of SHORT_BRIDGE_SEGMENT_WORDS) {
              const bridgeSuffix = `${bridgeWord}${shortExact}`;
              if (!lowerCurrent.endsWith(bridgeSuffix)) {
                continue;
              }
              const prefix = lowerCurrent.slice(0, -bridgeSuffix.length);
              if (prefix.length < 4 || !domainWords.has(prefix)) {
                continue;
              }
              // Domain-Präfix + Brücke + Short-Exact dürfen als Anzeige gesplittet werden.
              nextTokens.push(current.slice(0, prefix.length));
              nextTokens.push(bridgeWord.toUpperCase());
              nextTokens.push(shortExact.toUpperCase());
              splitApplied = true;
              break;
            }
            if (splitApplied) {
              break;
            }
          }
        }

        if (!splitApplied) {
          for (let splitIndex = lowerCurrent.length - 3; splitIndex >= 3; splitIndex -= 1) {
            const prefix = lowerCurrent.slice(0, splitIndex);
            const suffix = lowerCurrent.slice(splitIndex);
            if (prefix.length < 4 || suffix.length < 4) {
              continue;
            }
            if (domainWords.has(prefix) && domainWords.has(suffix)) {
              // Zwei Domain-Wörter dürfen als Anzeige getrennt werden.
              nextTokens.push(current.slice(0, splitIndex));
              nextTokens.push(current.slice(splitIndex));
              splitApplied = true;
              break;
            }
          }
        }

        if (!splitApplied) {
          nextTokens.push(current);
        } else {
          changed = true;
        }
      }
      working = nextTokens;
      if (!changed) {
        break;
      }
    }

    const merged = [];
    let index = 0;
    while (index < working.length) {
      const current = working[index];
      const next = working[index + 1];
      if (next && domainWords.has(`${current}${next}`.toLowerCase())) {
        // Anzeige darf Domain-Komposita zusammenziehen, auch wenn der Score-Token-Path feiner bleibt.
        merged.push(`${current}${next}`);
        index += 2;
        continue;
      }
      merged.push(current);
      index += 1;
    }

    return merged;
  }

  function createEmptyTextAnalysis() {
    return {
      rawText: "",
      displayText: "",
      displayTokens: [],
      scoreTokens: [],
      coverage: 0,
      meaningfulTokenRatio: 0,
      unknownRatio: 0,
      confidence: 0,
      averageTokenScore: 0,
      plausibleOovRatio: 0,
      supportedBridgeRatio: 0,
      strongSegmentRatio: 0,
      lexiconCoverage: 0,
      boundaryCount: 0,
      weakBoundaryCount: 0,
      unsupportedBridgeCount: 0,
      shortTokenCount: 0,
      qualityScore: 0,
    };
  }

  function analyzeTextQuality(text, options) {
    const opts = options && typeof options === "object" ? options : {};
    const languageHints = resolveLanguageHints(opts.languageHints);
    const maxWordLength = Number.isFinite(opts.maxWordLength)
      ? Math.max(6, Math.min(64, Math.floor(opts.maxWordLength)))
      : 40;
    const extraWords = Array.isArray(opts.extraWords) ? opts.extraWords : [];
    const model = resolveSegmentModel(languageHints, extraWords);
    const normalizedSource = normalizeSegmentSource(text);
    const runs = normalizedSource.match(/[A-Z]+/g) || [];
    const rawText = runs.join(" ").trim();

    if (runs.length === 0) {
      return createEmptyTextAnalysis();
    }

    const scoreTokens = [];
    const displayTokens = [];
    const runMetrics = [];
    let lettersTotal = 0;

    for (const run of runs) {
      const runResult = segmentUppercaseRun(run, model, maxWordLength);
      const selected = chooseRunTokensForDisplay(runResult);
      scoreTokens.push(...selected.scoreTokens);
      displayTokens.push(...selected.displayTokens);
      runMetrics.push(selected.scoreMetrics);
      lettersTotal += run.length;
    }

    const aggregated = buildAggregatedMetricsFromRuns(runMetrics, lettersTotal);

    let displayTokenTexts = displayTokens.map((token) => token.text);
    const scoreTokenTexts = scoreTokens.map((token) => token.text);
    if (
      displayTokenTexts.length === 1 &&
      scoreTokens.length > 1 &&
      scoreTokens.every(
        (token) => token.kind !== "raw_unknown" && token.kind !== "unknown_word"
      )
    ) {
      // Wenn nur bekannte Wörter gefunden wurden, darf die Anzeige dem Score-Token-Pfad folgen.
      displayTokenTexts = scoreTokenTexts;
    }
    const mergedDisplayTokenTexts = mergeDomainDisplayTokenTexts(displayTokenTexts, model);

    return {
      rawText,
      displayText: mergedDisplayTokenTexts.join(" ").trim(),
      displayTokens: mergedDisplayTokenTexts,
      scoreTokens: scoreTokenTexts,
      ...aggregated,
    };
  }

  function segmentText(text, options) {
    const analysis = analyzeTextQuality(text, options);
    return {
      text: analysis.displayText,
      tokens: analysis.displayTokens,
      coverage: analysis.coverage,
      meaningfulTokenRatio: analysis.meaningfulTokenRatio,
      unknownRatio: analysis.unknownRatio,
      confidence: analysis.confidence,
      averageTokenScore: analysis.averageTokenScore,
      plausibleOovRatio: analysis.plausibleOovRatio,
      supportedBridgeRatio: analysis.supportedBridgeRatio,
      strongSegmentRatio: analysis.strongSegmentRatio,
      lexiconCoverage: analysis.lexiconCoverage,
      boundaryCount: analysis.boundaryCount,
      weakBoundaryCount: analysis.weakBoundaryCount,
      unsupportedBridgeCount: analysis.unsupportedBridgeCount,
      shortTokenCount: analysis.shortTokenCount,
      qualityScore: analysis.qualityScore,
      rawText: analysis.rawText,
      scoreTokens: analysis.scoreTokens,
    };
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

  function computeCandidateCompositeScore(baseConfidence, analysis, dictionaryStat) {
    const base = Number(baseConfidence) || 0;
    const dict = dictionaryStat || {
      coverage: 0,
      validWords: 0,
      totalWords: 0,
      preferredHint: false,
    };
    const analyzed = analysis || createEmptyTextAnalysis();
    const dictBoost = dict.coverage * 20 + dict.validWords * 1.2;
    const zeroPenalty = dict.totalWords >= 2 && dict.validWords === 0 ? -3.2 : 0;
    const languagePriorityBonus = dict.preferredHint ? 0.8 : 0;
    const boundaryPenalty =
      analyzed.weakBoundaryCount * 1.35 +
      analyzed.unsupportedBridgeCount * 1.6 +
      analyzed.shortTokenCount * 0.45;
    const analysisBlend = analyzed.qualityScore * 0.22;

    // Rohscore, Wörterbuchsignal und Shared-Analyse werden gemeinsam genutzt,
    // damit Legacy-Ranking stabil bleibt und Boundary-Qualität dennoch einfließt.
    return (
      base * 0.35 +
      dictBoost +
      zeroPenalty +
      languagePriorityBonus +
      analysisBlend -
      boundaryPenalty
    );
  }

  root.dictionaryScorer = {
    getKeyCandidates(options) {
      return getKeyCandidates(options || {});
    },

    analyzeTextQuality(text, options) {
      return analyzeTextQuality(text, options || {});
    },

    segmentText(text, options) {
      return segmentText(text, options || {});
    },

    async rankCandidates(candidates, options) {
      const languageHints = resolveLanguageHints(
        options && Array.isArray(options.languageHints) ? options.languageHints : null
      );

      const safeCandidates = Array.isArray(candidates) ? candidates : [];
      // Lokales Ranking bleibt deterministisch/offlinefähig. Die Analyse läuft
      // einheitlich über denselben Segment-/Boundary-Pfad wie im Playfair-Scoring.
      const localEvaluated = safeCandidates.map((candidate, index) => {
        const candidateShape = candidate && typeof candidate === "object" ? candidate : {};
        const base = Number(candidate && candidate.confidence) || 0;
        const candidateText = String(candidate && candidate.text ? candidate.text : "");
        const analysis = analyzeTextQuality(candidateText, {
          languageHints,
          maxWordLength: 40,
        });
        const dictionaryText = analysis.displayText || candidateText;
        const words = extractWords(dictionaryText);
        const localDict = evaluateTextLocally(words, languageHints);
        const combinedLocal = computeCandidateCompositeScore(base, analysis, localDict);
        return {
          ...candidateShape,
          text: candidateText,
          rankIndex: index,
          localConfidence: base,
          // Rohwert bleibt erhalten, damit ein späteres API-Rescoring nicht den
          // bereits lokal gemischten Score ein zweites Mal abdämpft.
          rawConfidence: base,
          analysis,
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
            const dict = await evaluateTextWithDictionary(
              candidate.analysis && candidate.analysis.displayText
                ? candidate.analysis.displayText
                : candidate.text,
              languageHints
            );
            const combinedScore = computeCandidateCompositeScore(
              candidate.rawConfidence,
              candidate.analysis,
              dict
            );
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
