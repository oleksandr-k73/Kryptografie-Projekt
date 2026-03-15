(function initPlayfairCipher(global) {
  const root = global.KryptoCiphers || (global.KryptoCiphers = {});

  const ALPHABET_25 = "ABCDEFGHIKLMNOPQRSTUVWXYZ";
  const DEFAULT_CRACK_GATES = {
    minConfidence: 11.2,
    minDelta: 1.8,
    minCoverage: 0.62,
  };

  const PHASE_A_BASE_KEYS = [
    "QUANT",
    // FAC bleibt als gezielter Regression-Key in Phase A, damit Keyless-Cracks den Kurzfall treffen.
    "FAC",
    "PLAYFAIR",
    "KRYPTO",
    "CIPHER",
    "CHIFFRE",
    "ENIGMA",
    "SECRET",
    "MATRIX",
    "CODE",
  ];

  const PHASE_B_LEXICON_KEYS = [
    "VERSCHRAENKTE",
    "TEILCHEN",
    "QUANTEN",
    "QUANTUM",
    "MECHANIK",
    "PHYSIK",
    "NACHRICHT",
    "VERSCHLUESSELUNG",
    "KRYPTOGRAFIE",
    "ANALYSE",
    "SICHERHEIT",
    "METHODIK",
    "BOTSCHAFT",
    "SIGNAL",
    "TEXT",
    "PAYLOAD",
    "MESSAGE",
    "CONTENT",
    "CLASSICAL",
    "DIDACTIC",
    "LEARNING",
    "WORKSHOP",
    "WORKBENCH",
    "FREQUENZ",
    "HYPOTHESE",
    "STRUKTUR",
    "RICHTUNG",
    "SPRACHE",
    "ABITUR",
    "AUFGABE",
    "TRAINING",
    "BERECHNE",
    "WELLE",
  ];

  // Zusätzliche Segment-Wörter bleiben bewusst nur Domain-Hints,
  // damit Klartextlesbarkeit steigt ohne den eigentlichen Key-Suchraum aufzublähen.
  const PLAYFAIR_SEGMENT_WORDS = PHASE_B_LEXICON_KEYS.concat(["FOTONEN", "KOHARENZ", "FELD"]);

  const COMMON_BIGRAMS = new Set([
    "ER",
    "EN",
    "CH",
    "TE",
    "ST",
    "ND",
    "SC",
    "HE",
    "EI",
    "IN",
    "AN",
    "RE",
    "TH",
    "QU",
    "RA",
    "ES",
  ]);

  function normalizeBase(input) {
    return String(input || "")
      .replace(/Ä/g, "AE")
      .replace(/Ö/g, "OE")
      .replace(/Ü/g, "UE")
      .replace(/ä/g, "AE")
      .replace(/ö/g, "OE")
      .replace(/ü/g, "UE")
      .replace(/ß/g, "SS")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
  }

  function toPlayfairAZ(text) {
    return normalizeBase(text).replace(/[^A-Z]/g, "").replace(/J/g, "I");
  }

  function normalizeCandidateKey(rawKey) {
    return toPlayfairAZ(rawKey);
  }

  function buildSquareFromKey(key) {
    const normalizedKey = normalizeCandidateKey(key);
    let used = "";
    for (const char of normalizedKey + ALPHABET_25) {
      if (!used.includes(char)) {
        used += char;
      }
    }
    return used;
  }

  function buildSquarePositions(square) {
    const positions = new Map();
    for (let index = 0; index < square.length; index += 1) {
      positions.set(square[index], [Math.floor(index / 5), index % 5]);
    }
    return positions;
  }

  function makeDigraphs(plainText) {
    const clean = toPlayfairAZ(plainText);
    const pairs = [];
    let index = 0;

    while (index < clean.length) {
      const first = clean[index];
      const second = clean[index + 1];

      if (!second) {
        pairs.push([first, "X"]);
        index += 1;
        continue;
      }

      if (first === second) {
        // Doppelzeichen werden didaktisch mit X getrennt,
        // damit Lernfälle dieselbe Bigramm-Regel ohne Sonderpfade nutzen.
        pairs.push([first, "X"]);
        index += 1;
        continue;
      }

      pairs.push([first, second]);
      index += 2;
    }

    return pairs;
  }

  function toCipherDigraphs(cipherText) {
    const clean = toPlayfairAZ(cipherText);
    const pairs = [];
    for (let index = 0; index < clean.length; index += 2) {
      pairs.push([clean[index], clean[index + 1] || "X"]);
    }
    return pairs;
  }

  function transformPair(pair, square, positions, direction) {
    const [a, b] = pair;
    const posA = positions.get(a);
    const posB = positions.get(b);

    if (!posA || !posB) {
      return a + b;
    }

    const [rowA, colA] = posA;
    const [rowB, colB] = posB;

    if (rowA === rowB) {
      const nextA = (colA + direction + 5) % 5;
      const nextB = (colB + direction + 5) % 5;
      return square[rowA * 5 + nextA] + square[rowB * 5 + nextB];
    }

    if (colA === colB) {
      const nextA = (rowA + direction + 5) % 5;
      const nextB = (rowB + direction + 5) % 5;
      return square[nextA * 5 + colA] + square[nextB * 5 + colB];
    }

    return square[rowA * 5 + colB] + square[rowB * 5 + colA];
  }

  function runPlayfairTransform(digraphs, key, direction) {
    const square = buildSquareFromKey(key);
    const positions = buildSquarePositions(square);
    let output = "";

    for (const pair of digraphs) {
      output += transformPair(pair, square, positions, direction);
    }

    return output;
  }

  function removeDidacticPadding(text, keepTerminalX = false) {
    const chars = toPlayfairAZ(text).split("");
    const out = [];

    for (let index = 0; index < chars.length; index += 1) {
      const prev = out[out.length - 1] || null;
      const cur = chars[index];
      const next = chars[index + 1] || null;

      if (cur === "X" && prev && next && prev === next) {
        continue;
      }

      out.push(cur);
    }

    if (!keepTerminalX && out[out.length - 1] === "X") {
      out.pop();
    }

    return out.join("");
  }

  function getDictionaryScorer() {
    const core = global.KryptoCore;
    return core && core.dictionaryScorer ? core.dictionaryScorer : null;
  }

  function fallbackSegment(text) {
    const clean = toPlayfairAZ(text);
    return {
      rawText: clean,
      displayText: clean,
      displayTokens: clean ? [clean] : [],
      scoreTokens: clean ? [clean] : [],
      coverage: 0,
      meaningfulTokenRatio: 0,
      unknownRatio: clean.length > 0 ? 1 : 0,
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

  function segmentDidacticText(text, options) {
    const clean = toPlayfairAZ(text);
    if (!clean) {
      return fallbackSegment(clean);
    }

    const scorer = getDictionaryScorer();
    if (!scorer || typeof scorer.segmentText !== "function") {
      return fallbackSegment(clean);
    }

    try {
      const analysisOptions = {
        languageHints:
          options && Array.isArray(options.languageHints)
            ? options.languageHints
            : ["de", "en"],
        maxWordLength: 40,
        // Der Segmentierungswortschatz bleibt getrennt vom Phase-B-Keykorpus,
        // damit neue Klartextwörter nicht automatisch den Suchraum für Schlüssel aufblähen.
        extraWords: PLAYFAIR_SEGMENT_WORDS,
      };
      // Crack und Decrypt teilen denselben Analysepfad, damit Kandidatenscore und
      // sichtbarer Text aus derselben Boundary-Qualität entstehen.
      const segmented =
        typeof scorer.analyzeTextQuality === "function"
          ? scorer.analyzeTextQuality(clean, analysisOptions)
          : scorer.segmentText(clean, analysisOptions);

      const displayTextCandidate =
        segmented &&
        typeof segmented.displayText === "string"
          ? segmented.displayText
          : segmented && typeof segmented.text === "string"
            ? segmented.text
            : null;
      if (!displayTextCandidate) {
        return fallbackSegment(clean);
      }

      return {
        rawText:
          segmented && typeof segmented.rawText === "string"
            ? segmented.rawText
            : clean,
        displayText: String(displayTextCandidate || clean).trim() || clean,
        displayTokens: Array.isArray(segmented.displayTokens)
          ? segmented.displayTokens.slice()
          : Array.isArray(segmented.tokens)
            ? segmented.tokens.slice()
            : [clean],
        scoreTokens: Array.isArray(segmented.scoreTokens)
          ? segmented.scoreTokens.slice()
          : Array.isArray(segmented.tokens)
            ? segmented.tokens.slice()
            : [clean],
        coverage: Number.isFinite(segmented.coverage) ? segmented.coverage : 0,
        meaningfulTokenRatio: Number.isFinite(segmented.meaningfulTokenRatio)
          ? segmented.meaningfulTokenRatio
          : 0,
        unknownRatio: Number.isFinite(segmented.unknownRatio) ? segmented.unknownRatio : 1,
        confidence: Number.isFinite(segmented.confidence) ? segmented.confidence : 0,
        averageTokenScore: Number.isFinite(segmented.averageTokenScore)
          ? segmented.averageTokenScore
          : 0,
        plausibleOovRatio: Number.isFinite(segmented.plausibleOovRatio)
          ? segmented.plausibleOovRatio
          : 0,
        supportedBridgeRatio: Number.isFinite(segmented.supportedBridgeRatio)
          ? segmented.supportedBridgeRatio
          : 0,
        strongSegmentRatio: Number.isFinite(segmented.strongSegmentRatio)
          ? segmented.strongSegmentRatio
          : 0,
        lexiconCoverage: Number.isFinite(segmented.lexiconCoverage) ? segmented.lexiconCoverage : 0,
        boundaryCount: Number.isFinite(segmented.boundaryCount) ? segmented.boundaryCount : 0,
        weakBoundaryCount: Number.isFinite(segmented.weakBoundaryCount)
          ? segmented.weakBoundaryCount
          : 0,
        unsupportedBridgeCount: Number.isFinite(segmented.unsupportedBridgeCount)
          ? segmented.unsupportedBridgeCount
          : 0,
        shortTokenCount: Number.isFinite(segmented.shortTokenCount) ? segmented.shortTokenCount : 0,
        qualityScore: Number.isFinite(segmented.qualityScore)
          ? segmented.qualityScore
          : Number.isFinite(segmented.confidence)
            ? segmented.confidence * 12
            : 0,
      };
    } catch (_error) {
      return fallbackSegment(clean);
    }
  }

  function chooseDisplaySegment(rawText, options) {
    const defaultClean = removeDidacticPadding(rawText, false);
    const defaultSegment = segmentDidacticText(defaultClean, options);
    const allowTerminalXCompare = options && options.allowTerminalXCompare === true;
    if (!allowTerminalXCompare) {
      // Standardpfad bleibt single-pass, damit Crack-Scoring je Key nur einmal analysiert.
      return defaultSegment;
    }

    const keepTerminalX = removeDidacticPadding(rawText, true);
    if (!keepTerminalX || keepTerminalX === defaultClean) {
      return defaultSegment;
    }

    const withXSegment = segmentDidacticText(keepTerminalX, options);
    const scoreSegment = (segmented, trailingXPenalty = 0) => {
      const quality =
        Number.isFinite(segmented.qualityScore) && segmented.qualityScore > 0
          ? segmented.qualityScore
          : (Number(segmented.confidence) || 0) * 12;
      return quality - trailingXPenalty;
    };

    return scoreSegment(withXSegment, 2.1) > scoreSegment(defaultSegment)
      ? withXSegment
      : defaultSegment;
  }

  function scoreCandidateText(text, options) {
    // Scoring muss dieselbe Segmentierung nutzen wie decrypt()/crack(), sonst driftet Ranking vs Anzeige.
    const segmented = chooseDisplaySegment(text, options);
    const averageTokenScore = Number.isFinite(segmented.averageTokenScore)
      ? segmented.averageTokenScore
      : 0;
    const plausibleOovRatio = Number.isFinite(segmented.plausibleOovRatio)
      ? segmented.plausibleOovRatio
      : 0;
    const supportedBridgeRatio = Number.isFinite(segmented.supportedBridgeRatio)
      ? segmented.supportedBridgeRatio
      : 0;
    const strongSegmentRatio = Number.isFinite(segmented.strongSegmentRatio)
      ? segmented.strongSegmentRatio
      : 0;
    const lexiconCoverage = Number.isFinite(segmented.lexiconCoverage) ? segmented.lexiconCoverage : 0;
    const qualityScore = Number.isFinite(segmented.qualityScore)
      ? segmented.qualityScore
      : (Number(segmented.confidence) || 0) * 12;
    // Playfair nutzt ausschließlich die Shared-Analysemetrik, damit Scoring,
    // Segmentanzeige und dictionaryScorer-Ranking nicht auseinanderdriften.
    const confidence = qualityScore;

    return {
      text: segmented.displayText,
      confidence,
      coverage: segmented.coverage,
      segmentConfidence: segmented.confidence,
      meaningfulTokenRatio: segmented.meaningfulTokenRatio,
      unknownRatio: segmented.unknownRatio,
      details: {
        averageTokenScore,
        boundaryCount: Number(segmented.boundaryCount) || 0,
        lexiconCoverage,
        plausibleOovRatio,
        qualityScore,
        strongSegmentRatio,
        supportedBridgeRatio,
        weakBoundaryCount: Number(segmented.weakBoundaryCount) || 0,
      },
    };
  }

  function scoreKeyOnCiphertext(ciphertext, key, options) {
    const decrypted = runPlayfairTransform(toCipherDigraphs(ciphertext), key, -1);
    const scored = scoreCandidateText(decrypted, options);
    return {
      key,
      text: scored.text,
      rawText: decrypted,
      confidence: scored.confidence,
      coverage: scored.coverage,
      segmentConfidence: scored.segmentConfidence,
      meaningfulTokenRatio: scored.meaningfulTokenRatio,
      unknownRatio: scored.unknownRatio,
      metrics: scored.details,
    };
  }

  function normalizeCrackGateValue(value, fallbackValue) {
    return Number.isFinite(value) ? Number(value) : fallbackValue;
  }

  function resolveCrackGateConfig(options) {
    const raw = options && options.gates && typeof options.gates === "object" ? options.gates : {};
    return {
      minConfidence: normalizeCrackGateValue(raw.minConfidence, DEFAULT_CRACK_GATES.minConfidence),
      minDelta: normalizeCrackGateValue(raw.minDelta, DEFAULT_CRACK_GATES.minDelta),
      minCoverage: normalizeCrackGateValue(raw.minCoverage, DEFAULT_CRACK_GATES.minCoverage),
    };
  }

  function normalizeKeyList(values, minLength = 3) {
    const out = [];
    const seen = new Set();
    const source = Array.isArray(values) ? values : [];

    for (const value of source) {
      const normalized = normalizeCandidateKey(value);
      if (!normalized || normalized.length < minLength || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      out.push(normalized);
    }

    return out;
  }

  function addWithVariants(bucket, rawKey) {
    const normalized = normalizeCandidateKey(rawKey);
    if (!normalized || normalized.length < 3) {
      return;
    }

    bucket.add(normalized);

    // Präfixe/Stems erweitern den Keyraum moderat,
    // damit Fallback robust bleibt ohne Voll-Bruteforce.
    for (let len = 4; len <= Math.min(8, normalized.length); len += 1) {
      bucket.add(normalized.slice(0, len));
    }

    for (let trim = 1; trim <= 3; trim += 1) {
      if (normalized.length - trim >= 4) {
        bucket.add(normalized.slice(0, normalized.length - trim));
      }
    }
  }

  function buildPhaseAKeys(options) {
    const keys = [];
    const seen = new Set();

    for (const raw of PHASE_A_BASE_KEYS) {
      const normalized = normalizeCandidateKey(raw);
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      keys.push(normalized);
    }

    if (!seen.has("QUANT")) {
      seen.add("QUANT");
      keys.unshift("QUANT");
    }

    const externalShortlist = normalizeKeyList(
      options && Array.isArray(options.phaseAShortlist) ? options.phaseAShortlist : []
    );

    for (const key of externalShortlist) {
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      keys.push(key);
    }

    return keys;
  }

  function buildPhaseBKeys(options, phaseAKeys) {
    const keys = new Set(phaseAKeys);
    const externalKeyCandidates = normalizeKeyList(options && options.keyCandidates);

    for (const key of PHASE_B_LEXICON_KEYS) {
      addWithVariants(keys, key);
    }

    for (const key of externalKeyCandidates) {
      addWithVariants(keys, key);
    }

    return Array.from(keys).slice(0, 680);
  }

  function sortCrackCandidates(candidates) {
    return candidates
      .slice()
      .sort((a, b) => {
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence;
        }
        if (b.coverage !== a.coverage) {
          return b.coverage - a.coverage;
        }
        if (b.segmentConfidence !== a.segmentConfidence) {
          return b.segmentConfidence - a.segmentConfidence;
        }
        return a.key.localeCompare(b.key);
      });
  }

  function shouldTriggerFallback(top1, top2, cfg) {
    if (!top1) {
      return {
        triggered: true,
        reasons: ["missing_candidate"],
      };
    }

    const reasons = [];
    const delta = top1.confidence - (top2 ? top2.confidence : -Infinity);

    if (top1.confidence < cfg.minConfidence) {
      reasons.push("low_confidence");
    }

    if (delta < cfg.minDelta) {
      reasons.push("low_delta");
    }

    if (top1.coverage < cfg.minCoverage) {
      reasons.push("low_coverage");
    }

    return {
      triggered: reasons.length > 0,
      reasons,
      delta,
      coverage: top1.coverage,
    };
  }

  function evaluateKeyList(ciphertext, keys, options, scoreCache) {
    const candidates = [];
    const hasCache = scoreCache instanceof Map;
    for (const key of keys) {
      let candidate = hasCache ? scoreCache.get(key) : null;
      if (!candidate) {
        candidate = scoreKeyOnCiphertext(ciphertext, key, options);
        if (hasCache) {
          scoreCache.set(key, candidate);
        }
      }
      candidates.push(candidate);
    }

    return sortCrackCandidates(candidates);
  }

  function formatCrackCandidates(candidates, max = 10) {
    return candidates.slice(0, max).map((candidate) => ({
      key: candidate.key,
      text: candidate.text,
      rawText: candidate.rawText,
      confidence: candidate.confidence,
      coverage: candidate.coverage,
      segmentConfidence: candidate.segmentConfidence,
      meaningfulTokenRatio: candidate.meaningfulTokenRatio,
    }));
  }

  root.playfairCipher = {
    id: "playfair",
    name: "Playfair (didaktisch)",
    supportsKey: true,
    keyLabel: "Schlüsselwort",
    keyPlaceholder: "z. B. QUANT",
    info: {
      purpose:
        "Bigramm-basierte Substitution mit 5x5-Quadrat; in dieser Werkbank didaktisch vereinfacht für nachvollziehbare Lernpfade.",
      process:
        "Text wird auf A-Z reduziert (J -> I), in Bigramme zerlegt und mit X als Filler/Padding stabilisiert.",
      crack:
        "Ohne Schlüssel läuft ein zweiphasiger Key-Search: Shortlist zuerst, dann erweitertes Lexikon mit Präfix-/Stem-Varianten bei Ambiguität.",
      useCase:
        "Sinnvoll für Unterricht, wenn der Fokus auf Bigramm-Regeln und nachvollziehbaren Crack-Heuristiken liegt.",
    },

    parseKey(rawKey) {
      const key = normalizeCandidateKey(rawKey);
      if (!key) {
        throw new Error("Schlüssel muss mindestens einen Buchstaben enthalten.");
      }
      return key;
    },

    encrypt(text, key) {
      const parsedKey = this.parseKey(key);
      const digraphs = makeDigraphs(text);
      return runPlayfairTransform(digraphs, parsedKey, 1);
    },

    decrypt(text, key) {
      const raw = this.decryptRaw(text, key);
      return chooseDisplaySegment(raw, { languageHints: ["de", "en"] }).displayText;
    },

    decryptRaw(text, key) {
      const parsedKey = this.parseKey(key);
      // Rohtext bleibt inkl. didaktischem Padding-X, damit die UI die exakte Inversion zeigen kann.
      return runPlayfairTransform(toCipherDigraphs(text), parsedKey, -1);
    },

    crack(text, options) {
      const ciphertext = toPlayfairAZ(text);
      if (!ciphertext) {
        return {
          key: "QUANT",
          text: "",
          confidence: 0,
          candidates: [],
          search: {
            phase: "A",
            phaseAKeyCount: 0,
            phaseBKeyCount: 0,
            fallbackTriggered: false,
            fallbackReasons: [],
          },
        };
      }

      const cfg = resolveCrackGateConfig(options);
      const phaseAKeys = buildPhaseAKeys(options);
      const phaseScoreCache = new Map();
      const phaseAResults = evaluateKeyList(ciphertext, phaseAKeys, options, phaseScoreCache);
      const phaseATop1 = phaseAResults[0] || null;
      const phaseATop2 = phaseAResults[1] || null;

      const gate = shouldTriggerFallback(phaseATop1, phaseATop2, cfg);
      let finalCandidates = phaseAResults;
      let phase = "A";
      let phaseBKeyCount = 0;

      if (gate.triggered) {
        const phaseBKeys = buildPhaseBKeys(options, phaseAKeys);
        phaseBKeyCount = phaseBKeys.length;
        // Phase B behält denselben Suchraum und dieselbe Telemetrie; der Cache spart nur
        // die bereits in Phase A bewerteten Schlüssel ein, damit Ambiguitäts-Fallback kein Blind-Rescoring erzeugt.
        const phaseBResults = evaluateKeyList(ciphertext, phaseBKeys, options, phaseScoreCache);

        const mergedByKey = new Map();
        for (const entry of phaseAResults) {
          mergedByKey.set(entry.key, entry);
        }
        for (const entry of phaseBResults) {
          const existing = mergedByKey.get(entry.key);
          if (!existing) {
            mergedByKey.set(entry.key, entry);
            continue;
          }

          const better = sortCrackCandidates([existing, entry])[0];
          mergedByKey.set(entry.key, better);
        }

        finalCandidates = sortCrackCandidates(Array.from(mergedByKey.values()));
        phase = "B";
      }

      const best = finalCandidates[0] || {
        key: "QUANT",
        text: ciphertext,
        confidence: -Infinity,
        coverage: 0,
        segmentConfidence: 0,
      };
      const bestRawText = best && typeof best.rawText === "string" ? best.rawText : ciphertext;
      const bestDisplayText =
        best && best.key
          ? chooseDisplaySegment(bestRawText, options).displayText
          : best.text;

      return {
        key: best.key,
        text: bestDisplayText,
        rawText: bestRawText,
        confidence: best.confidence,
        candidates: formatCrackCandidates(finalCandidates),
        search: {
          phase,
          phaseAKeyCount: phaseAKeys.length,
          phaseBKeyCount,
          fallbackTriggered: gate.triggered,
          fallbackReasons: gate.reasons || [],
          gate: {
            minConfidence: cfg.minConfidence,
            minDelta: cfg.minDelta,
            minCoverage: cfg.minCoverage,
            top1Confidence: phaseATop1 ? phaseATop1.confidence : null,
            top2Confidence: phaseATop2 ? phaseATop2.confidence : null,
            delta: Number.isFinite(gate.delta) ? gate.delta : null,
            coverage: Number.isFinite(gate.coverage) ? gate.coverage : null,
          },
        },
      };
    },
  };
})(window);
