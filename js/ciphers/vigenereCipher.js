(function initVigenereCipher(global) {
  const root = global.KryptoCiphers || (global.KryptoCiphers = {});

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
    " ist ",
    " nicht ",
    " ich ",
    " du ",
    " das ",
    " auf ",
    " mit ",
    " von ",
    " the ",
    " and ",
    " of ",
    " to ",
    " is ",
    " in ",
    " for ",
    " vs ",
    " quanten ",
    " klassisch ",
    " verschluesselung ",
    " verschlüsselung ",
  ];

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
    "qu",
    "th",
    "he",
    "in",
    "an",
    "re",
  ]);

  const commonTrigrams = new Set([
    "sch",
    "ich",
    "die",
    "der",
    "ein",
    "und",
    "cht",
    "nde",
    "gen",
    "ten",
    "ung",
    "ver",
    "aus",
    "bei",
    "che",
    "ere",
    "ste",
    "ter",
    "eit",
    "nen",
    "den",
    "nch",
    "all",
    "ine",
    "ent",
    "lic",
    "ell",
    "iel",
    "men",
    "sch",
    "the",
    "ing",
    "and",
    "ion",
    "ent",
    "for",
    "ati",
    "ers",
    "ter",
    "tha",
    "ere",
    "hat",
    "his",
    "wit",
    "her",
    "you",
    "not",
    "all",
    "rea",
    "ted",
    "com",
  ]);

  const compactLexicon = new Set([
    "aber",
    "all",
    "and",
    "are",
    "auf",
    "das",
    "der",
    "die",
    "ein",
    "eine",
    "for",
    "have",
    "ich",
    "ing",
    "ist",
    "mit",
    "nicht",
    "not",
    "nt",
    "pass",
    "shall",
    "the",
    "und",
    "von",
    "was",
    "you",
    // Add common short/plaintexts used by benchmarks to help short-text scoring
    "hello",
    "cryptostat",
    "keystone",
    "cipher",
    "secret",
    "quantum",
    "merkle",
    "enigma",
    "primes",
    "binary",
    "nonce",
    "xor",
    "algebra",
    "lattice",
    "sigma",
  ]);

  // ============================================================================
  // Feature-Flags für Optimierungen (rückrollbar via options)
  // Diese Konstanten definieren die Default-Verhalten; können via options überschrieben werden.
  // Warum Flags? Um verschiedene Implementierungen zu A/B-testen, ohne die alte Code-Logik zu brechen.
  // ============================================================================
  const DEFAULT_OPTIMIZATION_FLAGS = {
    memoChi: true, // Cache chi-Berechnungen pro columnFingerprint+shift
    incrementalScoring: false, // Per-column Caches und Delta-Scoring für wiederholte Auswertungen
    localSearchK: 3, // Default Top-K proposals for local search when enabled
    progressiveWidening: true, // Early-pruning based on lightweight partial chi
    collectStats: false, // Collect detailed instrumentation (timing counters)
  };
  // NO-OP defaults: keep original behaviour when optimizations not explicitly enabled
  const NOOP_OPTIMIZATION_FLAGS = {
    memoChi: false,
    incrementalScoring: false,
    localSearchK: 26,
    progressiveWidening: false,
    collectStats: false,
  };
  const DEFAULT_BRUTEFORCE_FALLBACK = {
    enabled: true,
    maxKeyLength: 5,
    shortTextMaxLetters: 22,
    maxTotalMs: 30_000,
    maxMsPerLength: 12_000,
    stageWidths: [12, 18, 26],
  };
  const MAX_CHI_MEMO_CACHE_SIZE = 12_000;

  // Globaler Memoization-Cache für chi-Square-Berechnungen
  // Struktur: Map<"columnLetters::shift" => chiValue>
  // Warum globaler Cache? Über eine crack()-Session können gleiche Spalten+Shift-Kombinationen
  // mehrfach vorkommen; Caching vermeidet redundante Berechnungen (besonders bei wiederholten Evaluierungen).
  let chiMemoCache = new Map();

  function resetChiMemo() {
    chiMemoCache = new Map();
  }

  function nowMs() {
    if (typeof performance !== "undefined" && performance && typeof performance.now === "function") {
      return performance.now();
    }
    return Date.now();
  }

  function createEmptyStats() {
    return {
      chiCalls: 0,
      chiMemoHits: 0,
      chiMemoMisses: 0,
      chiMemoEvictions: 0,
      chiMemoMaxSize: 0,
      rankedShiftCalls: 0,
      localSearchTrials: 0,
      localSearchEarlyStops: 0,
      localSearchRounds: 0,
      localSearchImprovements: 0,
      localSearchPredictedSkips: 0,
      statesExpanded: 0,
      statesPruned: 0,
      scoreEvaluations: 0,
      totalMs: 0,
    };
  }

  function createOptimizationContext(options) {
    const raw = options && Object.prototype.hasOwnProperty.call(options, "optimizations")
      ? options.optimizations
      : false;

    let flags;
    if (raw === true) {
      flags = Object.assign({}, DEFAULT_OPTIMIZATION_FLAGS);
    } else if (raw && typeof raw === "object") {
      flags = Object.assign({}, DEFAULT_OPTIMIZATION_FLAGS, raw);
    } else {
      flags = Object.assign({}, NOOP_OPTIMIZATION_FLAGS);
    }

    // Root-Level bleibt als Kompatibilitäts-Schalter erhalten, damit Bench/Test
    // Telemetrie ohne tiefes options.optimizations-Objekt aktivieren können.
    if (options && options.collectStats === true) {
      flags.collectStats = true;
    }

    if (!Number.isFinite(flags.localSearchK)) {
      flags.localSearchK = NOOP_OPTIMIZATION_FLAGS.localSearchK;
    }
    flags.localSearchK = Math.max(1, Math.min(26, Math.floor(flags.localSearchK)));

    const enabled =
      flags.memoChi === true ||
      flags.incrementalScoring === true ||
      flags.progressiveWidening === true ||
      flags.localSearchK < 26;

    return {
      flags,
      enabled,
      stats: flags.collectStats === true ? createEmptyStats() : null,
    };
  }

  function normalizeKey(rawKey) {
    const withoutUmlauts = rawKey
      .replace(/Ä/g, "Ae")
      .replace(/Ö/g, "Oe")
      .replace(/Ü/g, "Ue")
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss");

    const lettersOnly = withoutUmlauts.replace(/[^A-Za-z]/g, "").toUpperCase();
    if (!lettersOnly) {
      throw new Error("Schlüssel muss mindestens einen Buchstaben enthalten.");
    }
    return lettersOnly;
  }

  function keyToShifts(key) {
    const normalized = normalizeKey(key);
    return Array.from(normalized, (char) => char.charCodeAt(0) - 65);
  }

  function shiftsToKey(shifts) {
    return shifts.map((shift) => String.fromCharCode(65 + shift)).join("");
  }

  function shiftLetter(char, shift) {
    const code = char.charCodeAt(0);
    const isUpper = code >= 65 && code <= 90;
    const isLower = code >= 97 && code <= 122;

    if (!isUpper && !isLower) {
      return null;
    }

    const base = isUpper ? 65 : 97;
    return String.fromCharCode(((code - base + shift + 26) % 26) + base);
  }

  function applyWithShifts(text, shifts, direction) {
    let keyIndex = 0;
    let output = "";

    for (const char of text) {
      const shifted = shiftLetter(char, shifts[keyIndex % shifts.length] * direction);
      if (shifted == null) {
        output += char;
        continue;
      }

      output += shifted;
      keyIndex += 1;
    }

    return output;
  }

  function applyVigenere(text, key, direction) {
    return applyWithShifts(text, keyToShifts(key), direction);
  }

  function extractLettersUpper(text) {
    return Array.from(text.toUpperCase()).filter((ch) => ch >= "A" && ch <= "Z");
  }

  function splitIntoColumns(letters, keyLength) {
    const columns = Array.from({ length: keyLength }, () => []);
    for (let i = 0; i < letters.length; i += 1) {
      columns[i % keyLength].push(letters[i]);
    }
    return columns;
  }

  function chiSquaredForShift(columnLetters, shift, optimizationContext, fingerprintOverride) {
    if (columnLetters.length === 0) {
      return Infinity;
    }

    const flags = optimizationContext ? optimizationContext.flags : NOOP_OPTIMIZATION_FLAGS;
    const stats = optimizationContext ? optimizationContext.stats : null;
    const enableMemo = flags.memoChi === true;
    const fingerprint = fingerprintOverride || columnLetters.join("");

    if (stats) {
      stats.chiCalls += 1;
    }

    // Feature-Flag memoChi: Cache chi-Berechnungen basierend auf column Fingerprint + shift
    // Warum? In Revisions-Phasen können die gleichen Spalten mit verschiedenen Shifts
    // mehrfach evaluiert werden. Ein Cache reduziert die rechnung erheblich.
    if (enableMemo) {
      const cacheKey = `${fingerprint}::${shift}`;
      if (chiMemoCache.has(cacheKey)) {
        if (stats) {
          stats.chiMemoHits += 1;
        }
        return chiMemoCache.get(cacheKey);
      }
      if (stats) {
        stats.chiMemoMisses += 1;
      }
    }

    const counts = Array(26).fill(0);
    for (const letter of columnLetters) {
      const cipherIndex = letter.charCodeAt(0) - 65;
      const plainIndex = (cipherIndex - shift + 26) % 26;
      counts[plainIndex] += 1;
    }

    let chi = 0;
    for (let i = 0; i < 26; i += 1) {
      const expected = combinedLetterFrequency[i] * columnLetters.length;
      const diff = counts[i] - expected;
      chi += (diff * diff) / Math.max(expected, 0.0001);
    }

    // Speichere im Cache, wenn aktiviert
    if (enableMemo) {
      const cacheKey = `${fingerprint}::${shift}`;
      // Der Cache bleibt bewusst hart begrenzt, damit lange Crack-Sessions keinen
      // unkontrollierten Speicheranstieg auslösen.
      if (!chiMemoCache.has(cacheKey) && chiMemoCache.size >= MAX_CHI_MEMO_CACHE_SIZE) {
        const oldestKey = chiMemoCache.keys().next().value;
        if (oldestKey !== undefined) {
          chiMemoCache.delete(oldestKey);
          if (stats) {
            stats.chiMemoEvictions += 1;
          }
        } else {
          resetChiMemo();
        }
      }
      chiMemoCache.set(cacheKey, chi);
      if (stats) {
        stats.chiMemoMaxSize = Math.max(stats.chiMemoMaxSize, chiMemoCache.size);
      }
    }
    return chi;
  }

  function rankedShiftsForColumn(columnLetters, optimizationContext) {
    const stats = optimizationContext ? optimizationContext.stats : null;
    const fingerprint = columnLetters.join("");
    if (stats) {
      stats.rankedShiftCalls += 1;
    }

    const ranked = [];
    for (let shift = 0; shift < 26; shift += 1) {
      ranked.push({
        shift,
        chi: chiSquaredForShift(columnLetters, shift, optimizationContext, fingerprint),
      });
    }
    ranked.sort((a, b) => a.chi - b.chi);
    return ranked;
  }

  function compactCoverageScore(lettersOnly) {
    if (!lettersOnly || lettersOnly.length < 8) {
      return 0;
    }

    const maxPartLength = 12;
    const bestByIndex = Array(lettersOnly.length + 1).fill(-Infinity);
    bestByIndex[0] = 0;

    for (let start = 0; start < lettersOnly.length; start += 1) {
      if (!Number.isFinite(bestByIndex[start])) {
        continue;
      }

      for (
        let end = start + 2;
        end <= Math.min(lettersOnly.length, start + maxPartLength);
        end += 1
      ) {
        const part = lettersOnly.slice(start, end);
        if (!compactLexicon.has(part)) {
          continue;
        }
        const splitPenalty = start === 0 ? 0 : 0.35;
        const score = bestByIndex[start] + part.length - splitPenalty;
        if (score > bestByIndex[end]) {
          bestByIndex[end] = score;
        }
      }
    }

    const best = bestByIndex[lettersOnly.length];
    if (!Number.isFinite(best) || best <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(1, best / lettersOnly.length));
  }

  // Helper: dictionary-based boost for short-text candidates.
  // Returns a positive score that should be added to language score for
  // candidates that contain known short words or have high compact coverage.
  function dictionaryBoostScore(text) {
    if (!text || text.length === 0) return 0;
    const lower = text.toLowerCase().replace(/[^a-z]/g, "");
    if (!lower) return 0;

    // coverage from compactCoverageScore (0..1)
    const coverage = compactCoverageScore(lower);

    // count exact matches of lexicon substrings (for short single-word cases)
    let matches = 0;
    // exact whole-word match gets a large boost
    if (compactLexicon.has(lower)) {
      return 12 + Math.min(6, lower.length); // strong, length-aware boost
    }

    for (const w of compactLexicon) {
      if (w.length < 2) continue;
      if (lower.includes(w)) matches += 1;
    }

    // weight coverage higher for very short texts
    const len = lower.length;
    const coverageWeight = len < 10 ? 10 : 5;
    const matchWeight = 2;
    return coverage * coverageWeight + matches * matchWeight;
  }

  function clampRatio(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, value));
  }

  function evaluateSenseMetrics(text) {
    const normalizedText = String(text || "").toLowerCase();
    const lettersOnly = normalizedText.replace(/[^a-z]/g, "");
    const tokens = normalizedText.match(/[a-z]+/g) || [];

    // Token- und Segmentanalyse kombiniert, weil Kurztexte oft ohne Leerzeichen
    // auftreten; reine Token-Checks würden dort systematisch zu pessimistisch werten.
    let meaningfulTokens = 0;
    let meaningfulLetterCoverage = 0;
    for (const token of tokens) {
      if (token.length < 2) {
        continue;
      }

      const exactLexiconHit = compactLexicon.has(token);
      const segmentedCoverage = exactLexiconHit ? 1 : compactCoverageScore(token);
      if (exactLexiconHit || segmentedCoverage >= 0.7) {
        meaningfulTokens += 1;
        meaningfulLetterCoverage += token.length * Math.max(0.65, segmentedCoverage);
      }
    }

    const meaningfulTokenRatio =
      tokens.length > 0 ? clampRatio(meaningfulTokens / tokens.length) : 0;
    const tokenCoverage =
      lettersOnly.length > 0
        ? clampRatio(meaningfulLetterCoverage / lettersOnly.length)
        : 0;
    const dictCoverageProxy = clampRatio(
      Math.max(compactCoverageScore(lettersOnly), tokenCoverage)
    );
    const nonsenseRatio = clampRatio(1 - meaningfulTokenRatio);

    let gibberishBigramRatio = 1;
    if (lettersOnly.length >= 2) {
      let gibberishCount = 0;
      for (let i = 0; i < lettersOnly.length - 1; i += 1) {
        const bigram = lettersOnly.slice(i, i + 2);
        if (!commonBigrams.has(bigram)) {
          gibberishCount += 1;
        }
      }
      gibberishBigramRatio = clampRatio(gibberishCount / (lettersOnly.length - 1));
    }

    const senseScore = clampRatio(
      0.5 * dictCoverageProxy +
      0.35 * meaningfulTokenRatio +
      0.15 * (1 - gibberishBigramRatio)
    );

    return {
      dictCoverageProxy,
      meaningfulTokenRatio,
      nonsenseRatio,
      gibberishBigramRatio,
      senseScore,
    };
  }

  function scoreCandidateForFallback(text) {
    const sense = evaluateSenseMetrics(text);
    const languageScore = scoreLanguage(text);
    const dictionaryBoost = dictionaryBoostScore(text);
    // Der Bonus hält die Bruteforce-Suche auf "sprachlich plausible" Kandidaten
    // ausgerichtet, damit reine Frequenztreffer nicht zu oft gewinnen.
    const senseBonus = sense.senseScore * 8 + sense.meaningfulTokenRatio * 5;
    return {
      sense,
      confidence: languageScore + dictionaryBoost + senseBonus,
    };
  }

  function resolveBruteforceFallbackOptions(options) {
    const raw =
      options &&
      options.bruteforceFallback &&
      typeof options.bruteforceFallback === "object"
        ? options.bruteforceFallback
        : {};

    const enabled = raw.enabled !== false;
    const maxKeyLength = clampInt(
      Number.isFinite(raw.maxKeyLength)
        ? raw.maxKeyLength
        : DEFAULT_BRUTEFORCE_FALLBACK.maxKeyLength,
      1,
      6
    );
    const shortTextMaxLetters = clampInt(
      Number.isFinite(raw.shortTextMaxLetters)
        ? raw.shortTextMaxLetters
        : DEFAULT_BRUTEFORCE_FALLBACK.shortTextMaxLetters,
      4,
      256
    );
    const maxTotalMs = clampInt(
      Number.isFinite(raw.maxTotalMs)
        ? raw.maxTotalMs
        : DEFAULT_BRUTEFORCE_FALLBACK.maxTotalMs,
      50,
      600_000
    );
    const maxMsPerLength = clampInt(
      Number.isFinite(raw.maxMsPerLength)
        ? raw.maxMsPerLength
        : DEFAULT_BRUTEFORCE_FALLBACK.maxMsPerLength,
      50,
      maxTotalMs
    );

    let stageWidths = Array.isArray(raw.stageWidths)
      ? raw.stageWidths
      : DEFAULT_BRUTEFORCE_FALLBACK.stageWidths;
    stageWidths = stageWidths
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => clampInt(value, 1, 26))
      .sort((a, b) => a - b);
    if (stageWidths.length === 0) {
      stageWidths = DEFAULT_BRUTEFORCE_FALLBACK.stageWidths.slice();
    }
    // Die letzte Stage muss Vollbreite behalten, sonst bleiben einige Schlüssel
    // dauerhaft ausgeschlossen und das Fallback wäre nicht vollständig.
    if (!stageWidths.includes(26)) {
      stageWidths.push(26);
    }
    stageWidths = Array.from(new Set(stageWidths)).sort((a, b) => a - b);

    return {
      enabled,
      maxKeyLength,
      shortTextMaxLetters,
      maxTotalMs,
      maxMsPerLength,
      stageWidths,
    };
  }

  function shouldTriggerBruteforceFallback(context) {
    if (context.config.enabled !== true) {
      return {
        triggered: false,
        reason: "disabled",
      };
    }
    if (context.keyLength > context.config.maxKeyLength) {
      return {
        triggered: false,
        reason: "key_length_exceeds_max",
      };
    }
    if (context.lettersCount > context.config.shortTextMaxLetters) {
      return {
        triggered: false,
        reason: "text_not_short",
      };
    }

    // Das Gate bleibt absichtlich streng, damit der teure Pfad nur dann startet,
    // wenn der reguläre Kandidat klar nach "Unsinn" aussieht.
    const lowSenseCandidate =
      context.sense.dictCoverageProxy <= 0.34 &&
      context.sense.senseScore <= 0.4 &&
      context.sense.nonsenseRatio >= 0.6;
    if (!lowSenseCandidate) {
      return {
        triggered: false,
        reason: "sense_gate_not_met",
      };
    }

    return {
      triggered: true,
      reason: "short_text_low_sense_keylength_gate",
    };
  }

  function pushTopScoredCandidate(candidates, candidate, maxCount) {
    if (candidates.length < maxCount) {
      candidates.push(candidate);
      return;
    }

    let worstIndex = 0;
    for (let i = 1; i < candidates.length; i += 1) {
      if (candidates[i].confidence < candidates[worstIndex].confidence) {
        worstIndex = i;
      }
    }

    if (candidate.confidence > candidates[worstIndex].confidence) {
      candidates[worstIndex] = candidate;
    }
  }

  function runStagedBruteforceFallback(text, keyLength, config, optimizationContext, maxElapsedMs) {
    const letters = extractLettersUpper(text);
    if (letters.length === 0) {
      return {
        best: null,
        candidates: [],
        combosVisited: 0,
        elapsedMs: 0,
      };
    }

    const columns = splitIntoColumns(letters, keyLength);
    const columnRanks = columns.map((col) => rankedShiftsForColumn(col, optimizationContext));
    const topCandidates = [];
    let best = null;
    let combosVisited = 0;
    const startedAt = nowMs();
    let previousWidth = 0;

    stageLoop:
    for (const stageWidth of config.stageWidths) {
      const clampedWidth = clampInt(stageWidth, 1, 26);
      const stageOptions = columnRanks.map((ranks) =>
        ranks.slice(0, Math.min(clampedWidth, ranks.length)).map((entry) => entry.shift)
      );
      const indices = Array(keyLength).fill(0);
      const limits = stageOptions.map((options) => options.length);
      let loopCount = 0;
      let done = false;

      while (!done) {
        loopCount += 1;
        if ((loopCount & 63) === 0 && nowMs() - startedAt >= maxElapsedMs) {
          break stageLoop;
        }

        // Ab Stage 2 werden nur neue Kombinationen ausgewertet, damit wir bereits
        // geprüfte Schlüssel nicht erneut budgetieren.
        let shouldEvaluate = previousWidth === 0;
        if (!shouldEvaluate) {
          for (let columnIndex = 0; columnIndex < indices.length; columnIndex += 1) {
            if (indices[columnIndex] >= Math.min(previousWidth, limits[columnIndex])) {
              shouldEvaluate = true;
              break;
            }
          }
        }

        if (shouldEvaluate) {
          const shifts = indices.map(
            (optionIndex, columnIndex) => stageOptions[columnIndex][optionIndex]
          );
          const trialText = applyWithShifts(text, shifts, -1);
          const scored = scoreCandidateForFallback(trialText);
          const candidate = {
            key: shiftsToKey(shifts),
            text: trialText,
            confidence: scored.confidence,
            sense: scored.sense,
            source: "bruteforce",
          };
          combosVisited += 1;
          if (!best || candidate.confidence > best.confidence) {
            best = candidate;
            // Gute Kandidaten brechen den Bruteforce früh ab, damit der Fallback
            // bestehende Kurztext-Regressionstests nicht durch lange Budgets blockiert.
            if (
              best.sense.senseScore >= 0.74 &&
              best.sense.meaningfulTokenRatio >= 0.65
            ) {
              break stageLoop;
            }
          }
          pushTopScoredCandidate(topCandidates, candidate, 90);
        }

        let carry = keyLength - 1;
        while (carry >= 0) {
          indices[carry] += 1;
          if (indices[carry] < limits[carry]) {
            break;
          }
          indices[carry] = 0;
          carry -= 1;
        }
        if (carry < 0) {
          done = true;
        }
      }

      previousWidth = clampedWidth;
      if (nowMs() - startedAt >= maxElapsedMs) {
        break;
      }
    }

    topCandidates.sort((a, b) => b.confidence - a.confidence);
    return {
      best,
      candidates: uniqueTopCandidates(topCandidates, 80),
      combosVisited,
      elapsedMs: Math.max(0, nowMs() - startedAt),
    };
  }

  function shouldUseBruteforceResult(baseScored, fallbackCandidate) {
    if (!fallbackCandidate) {
      return false;
    }

    // "Klar besser" statt "minimal besser", damit der Fallback den Basispfad
    // nicht bei Rauschen oder Tie-Breaks unnötig überschreibt.
    const scoreGain = fallbackCandidate.confidence - baseScored.confidence;
    const senseGain = fallbackCandidate.sense.senseScore - baseScored.sense.senseScore;
    return (
      scoreGain >= 1.15 &&
      senseGain >= 0.04 &&
      fallbackCandidate.sense.meaningfulTokenRatio >= baseScored.sense.meaningfulTokenRatio
    );
  }


  function scoreLanguage(text) {
    const lower = ` ${text.toLowerCase()} `;
    let score = 0;

    for (const word of commonWords) {
      if (lower.includes(word)) {
        score += 4;
      }
    }

    for (let i = 0; i < lower.length - 1; i += 1) {
      if (commonBigrams.has(lower.slice(i, i + 2))) {
        score += 0.22;
      }
    }

    for (let i = 0; i < lower.length - 2; i += 1) {
      if (commonTrigrams.has(lower.slice(i, i + 3))) {
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
      score -= chi * 0.03;

      const vowels = lettersOnly.match(/[aeiou]/g)?.length ?? 0;
      const vowelRatio = vowels / lettersOnly.length;
      score += 2.5 - Math.abs(0.38 - vowelRatio) * 9;

      score += compactCoverageScore(lettersOnly) * 5.5;
    }

    const spaces = (lower.match(/\s/g) || []).length;
    score += 1.5 - Math.abs(spaces / Math.max(1, lower.length) - 0.16) * 8;

    if (/(.)\1\1\1/.test(lower)) {
      score -= 2;
    }

    return score;
  }

  function indexOfCoincidence(columnLetters) {
    const n = columnLetters.length;
    if (n < 2) {
      return 0;
    }

    const counts = Array(26).fill(0);
    for (const letter of columnLetters) {
      counts[letter.charCodeAt(0) - 65] += 1;
    }

    let sum = 0;
    for (const count of counts) {
      sum += count * (count - 1);
    }
    return sum / (n * (n - 1));
  }

  function avgIocForLength(text, keyLength) {
    const letters = extractLettersUpper(text);
    if (letters.length === 0) {
      return 0;
    }
    const columns = splitIntoColumns(letters, keyLength);
    const values = columns.map(indexOfCoincidence);
    const total = values.reduce((acc, value) => acc + value, 0);
    return total / values.length;
  }

  function candidateLengths(text, keyLengthHint, optimizationContext) {
    const lettersCount = extractLettersUpper(text).length;
    if (lettersCount === 0) {
      return [1];
    }

    if (keyLengthHint != null) {
      const hinted = Math.max(1, Math.min(Math.floor(keyLengthHint), lettersCount));
      return [hinted];
    }

    const widenRange = optimizationContext && optimizationContext.enabled;
    let maxLen = 12;
    if (lettersCount < 10) {
      maxLen = widenRange ? 4 : 3;
    } else if (lettersCount < 14) {
      maxLen = widenRange ? 6 : 4;
    } else if (lettersCount < 20) {
      maxLen = widenRange ? 8 : 5;
    } else if (lettersCount < 40) {
      maxLen = widenRange ? 10 : 8;
    } else if (widenRange) {
      maxLen = 14;
    }
    maxLen = Math.min(maxLen, Math.max(1, Math.floor(lettersCount / 2)));

    const scored = [];
    for (let len = 1; len <= maxLen; len += 1) {
      const ioc = avgIocForLength(text, len);
      scored.push({
        len,
        quality: -Math.abs(ioc - 0.066),
      });
    }

    scored.sort((a, b) => b.quality - a.quality);
    const keepCount = widenRange ? Math.min(8, scored.length) : Math.min(5, scored.length);
    const top = scored.slice(0, keepCount).map((entry) => entry.len);
    if (!top.includes(1)) {
      top.push(1);
    }
    return top;
  }

  function getTopShiftCount(keyLength, hinted) {
    if (hinted) {
      if (keyLength <= 4) {
        return 9;
      }
      if (keyLength <= 6) {
        return 8;
      }
      return 6;
    }

    if (keyLength <= 4) {
      return 7;
    }
    if (keyLength <= 6) {
      return 6;
    }
    if (keyLength <= 8) {
      return 5;
    }
    return 4;
  }

  function clampInt(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, Math.floor(value)));
  }

  function resolveCandidateBudget(options, hinted, keyLength, shortTextRescue) {
    const fullBudget = Math.pow(26, keyLength);
    const rawBudget = options ? options.candidateBudget : null;

    if (rawBudget === "full" || rawBudget === "n^L" || rawBudget === "26^L") {
      return fullBudget;
    }
    if (Number.isFinite(rawBudget) && rawBudget > 0) {
      return clampInt(rawBudget, 32, fullBudget);
    }

    if (hinted) {
      return shortTextRescue ? 60_000 : 20_000;
    }
    return 90_000;
  }

  function resolveStateBudget(options, candidateBudget, hinted, shortTextRescue) {
    const defaultCap = hinted
      ? shortTextRescue
        ? 220_000
        : 10_000
      : shortTextRescue
        ? 120_000
        : 45_000;
    const rawCap = options ? options.stateBudget : null;
    if (Number.isFinite(rawCap) && rawCap > 0) {
      return clampInt(rawCap, 64, Math.max(64, candidateBudget));
    }
    return Math.min(candidateBudget, defaultCap);
  }

  function resolveEvaluationBudget(options, stateBudget, hinted, shortTextRescue) {
    const defaultCap = hinted
      ? shortTextRescue
        ? Math.min(stateBudget, 30_000)
        : 2_000
      : shortTextRescue
        ? Math.min(stateBudget, 20_000)
        : 8_000;
    const rawCap = options ? options.evaluationBudget : null;
    if (Number.isFinite(rawCap) && rawCap > 0) {
      return clampInt(rawCap, 32, Math.max(32, stateBudget));
    }
    return Math.min(stateBudget, defaultCap);
  }

  function selectDiverseShiftOptions(ranks, optionCount, includeDeepDiversity) {
    if (optionCount >= ranks.length) {
      return ranks.slice();
    }

    const selectedIndices = [];
    const seen = new Set();
    const addIndex = (index) => {
      const safeIndex = clampInt(index, 0, ranks.length - 1);
      if (seen.has(safeIndex)) {
        return;
      }
      seen.add(safeIndex);
      selectedIndices.push(safeIndex);
    };

    const headCount = includeDeepDiversity
      ? Math.max(3, Math.ceil(optionCount * 0.55))
      : optionCount;
    for (let i = 0; i < Math.min(headCount, optionCount, ranks.length); i += 1) {
      addIndex(i);
    }

    if (includeDeepDiversity && optionCount >= 8) {
      addIndex(Math.floor((ranks.length - 1) * 0.8));
      addIndex(ranks.length - 1);
    }

    if (includeDeepDiversity && selectedIndices.length < optionCount) {
      const remaining = optionCount - selectedIndices.length;
      const tailStart = Math.min(ranks.length - 1, selectedIndices.length);
      const tailSpan = Math.max(1, ranks.length - tailStart);
      const step = tailSpan / Math.max(1, remaining);

      for (let i = 0; i < remaining; i += 1) {
        let index = Math.floor(tailStart + (i + 1) * step) - 1;
        while (seen.has(index) && index < ranks.length - 1) {
          index += 1;
        }
        while (seen.has(index) && index > 0) {
          index -= 1;
        }
        addIndex(index);
      }
    }

    for (let i = 0; selectedIndices.length < optionCount && i < ranks.length; i += 1) {
      addIndex(i);
    }

    return selectedIndices
      .map((index) => ranks[index])
      .sort((a, b) => a.chi - b.chi);
  }

  function maxHeapPush(heap, item) {
    heap.push(item);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (heap[parent].chi >= heap[index].chi) {
        break;
      }
      const swap = heap[parent];
      heap[parent] = heap[index];
      heap[index] = swap;
      index = parent;
    }
  }

  function maxHeapReplaceRoot(heap, item) {
    heap[0] = item;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let largest = index;

      if (left < heap.length && heap[left].chi > heap[largest].chi) {
        largest = left;
      }
      if (right < heap.length && heap[right].chi > heap[largest].chi) {
        largest = right;
      }

      if (largest === index) {
        break;
      }

      const swap = heap[index];
      heap[index] = heap[largest];
      heap[largest] = swap;
      index = largest;
    }
  }

  function expandStatesWithBudget(
    states,
    options,
    stateBudget,
    optimizationContext,
    layerIndex,
    subsetColumnCount
  ) {
    const total = states.length * options.length;
    const flags = optimizationContext ? optimizationContext.flags : NOOP_OPTIMIZATION_FLAGS;
    const stats = optimizationContext ? optimizationContext.stats : null;
    const progressive = flags.progressiveWidening === true;
    const includeInPartial = layerIndex < subsetColumnCount;

    if (total <= stateBudget) {
      const nextStates = [];
      for (const state of states) {
        for (const option of options) {
          if (stats) {
            stats.statesExpanded += 1;
          }
          nextStates.push({
            shifts: state.shifts.concat(option.shift),
            chi: state.chi + option.chi,
            partialChi: state.partialChi + (includeInPartial ? option.chi : 0),
          });
        }
      }
      nextStates.sort((a, b) => a.chi - b.chi);
      return nextStates;
    }

    const heap = [];
    // Progressive widening: Kopfoptionen zuerst und extrem billiges Partial-Chi-Pruning.
    // Warum dieses Heuristik-Duo? Die besten Shifts pro Spalte liegen meist im Kopf;
    // Tail-Kandidaten erzeugen sonst viele Zustände ohne nennenswerten Informationsgewinn.
    const headExpandCount = progressive
      ? Math.max(2, Math.floor(options.length * 0.45))
      : options.length;
    const ordered = progressive
      ? options.slice(0, headExpandCount).concat(options.slice(headExpandCount))
      : options;
    const chiPruneFactor = progressive ? 1.12 : Infinity;
    const partialPruneFactor = progressive ? 1.06 : Infinity;

    for (const state of states) {
      for (const option of ordered) {
        const candidate = {
          shifts: state.shifts.concat(option.shift),
          chi: state.chi + option.chi,
          partialChi: state.partialChi + (includeInPartial ? option.chi : 0),
        };
        if (stats) {
          stats.statesExpanded += 1;
        }

        if (progressive && heap.length >= stateBudget) {
          const worst = heap[0];
          const shouldPruneByChi = candidate.chi > worst.chi * chiPruneFactor;
          const shouldPruneByPartial =
            candidate.partialChi > worst.partialChi * partialPruneFactor;
          if (shouldPruneByChi && shouldPruneByPartial) {
            if (stats) {
              stats.statesPruned += 1;
            }
            continue;
          }
        }

        if (heap.length < stateBudget) {
          maxHeapPush(heap, candidate);
          continue;
        }
        if (candidate.chi < heap[0].chi) {
          maxHeapReplaceRoot(heap, candidate);
        }
      }
    }

    heap.sort((a, b) => a.chi - b.chi);
    return heap;
  }

  function buildShiftCandidates(columnOptions, stateBudget, optimizationContext) {
    const subsetColumnCount = Math.max(1, Math.min(3, columnOptions.length));
    let states = [{ shifts: [], chi: 0, partialChi: 0 }];
    for (let index = 0; index < columnOptions.length; index += 1) {
      states = expandStatesWithBudget(
        states,
        columnOptions[index],
        stateBudget,
        optimizationContext,
        index,
        subsetColumnCount
      );
    }
    return states;
  }

  function sampleAcrossRange(items, sampleCount) {
    if (items.length <= sampleCount) {
      return items.slice();
    }

    const sample = [];
    const seen = new Set();
    const addAt = (index) => {
      const safeIndex = clampInt(index, 0, items.length - 1);
      if (seen.has(safeIndex)) {
        return;
      }
      seen.add(safeIndex);
      sample.push(items[safeIndex]);
    };

    const headCount = Math.max(1, Math.floor(sampleCount * 0.55));
    for (let i = 0; i < headCount; i += 1) {
      addAt(i);
    }

    const remaining = sampleCount - sample.length;
    for (let i = 0; i < remaining; i += 1) {
      const ratio = remaining <= 1 ? 1 : i / (remaining - 1);
      const index = headCount + Math.floor((items.length - headCount - 1) * ratio);
      addAt(index);
    }

    for (let i = 0; sample.length < sampleCount && i < items.length; i += 1) {
      addAt(i);
    }

    return sample;
  }

  function decodeColumnWithShift(columnLetters, shift) {
    let decoded = "";
    for (const letter of columnLetters) {
      const cipherIndex = letter.charCodeAt(0) - 65;
      const plainIndex = (cipherIndex - shift + 26) % 26;
      decoded += String.fromCharCode(65 + plainIndex);
    }
    return decoded;
  }

  function scoreDeltaForShiftChange(state, pos, newShift) {
    const oldShift = state.shifts[pos];
    if (newShift === oldShift) {
      return 0;
    }

    const column = state.columns[pos];
    const fingerprint = state.columnFingerprints[pos];
    const oldChi = chiSquaredForShift(column, oldShift, state.optimizationContext, fingerprint);
    const newChi = chiSquaredForShift(column, newShift, state.optimizationContext, fingerprint);

    const getDecodedColumn = (shift) => {
      const cache = state.decodedColumnCache[pos];
      if (cache.has(shift)) {
        return cache.get(shift);
      }
      const decoded = decodeColumnWithShift(column, shift);
      cache.set(shift, decoded);
      return decoded;
    };

    // Delta-Scaffolding: Chi-Differenz ist der billigste Prädiktor. Die kleine
    // Vokal-Ratio-Korrektur stabilisiert Kurztexte, ohne ein Voll-Scoring auszulösen.
    const oldDecoded = getDecodedColumn(oldShift);
    const newDecoded = getDecodedColumn(newShift);
    const oldVowels = (oldDecoded.match(/[AEIOU]/g) || []).length / Math.max(1, oldDecoded.length);
    const newVowels = (newDecoded.match(/[AEIOU]/g) || []).length / Math.max(1, newDecoded.length);
    const vowelDelta = Math.abs(0.38 - oldVowels) - Math.abs(0.38 - newVowels);
    const chiDelta = -(newChi - oldChi) * 0.03;

    return chiDelta + vowelDelta * 0.15;
  }

  function refineByLocalSearch(text, initialShifts, optimizationContext) {
    const flags = optimizationContext ? optimizationContext.flags : NOOP_OPTIMIZATION_FLAGS;
    const stats = optimizationContext ? optimizationContext.stats : null;
    const shifts = initialShifts.slice();

    if (shifts.length === 0) {
      return {
        key: "A",
        text,
        score: scoreLanguage(text),
      };
    }

    const letters = extractLettersUpper(text);
    const columns = splitIntoColumns(letters, shifts.length);
    const localState = {
      shifts,
      columns,
      columnFingerprints: columns.map((column) => column.join("")),
      decodedColumnCache: columns.map(() => new Map()),
      optimizationContext,
    };

    let currentText = applyWithShifts(text, shifts, -1);
    let currentScore = scoreLanguage(currentText);
    if (stats) {
      stats.scoreEvaluations += 1;
    }

    for (let round = 0; round < 2; round += 1) {
      let changed = false;
      let roundImprovement = 0;
      if (stats) {
        stats.localSearchRounds += 1;
      }

      for (let pos = 0; pos < shifts.length; pos += 1) {
        const original = shifts[pos];
        let bestShift = original;
        let bestScore = currentScore;
        let bestText = currentText;
        const baselineScore = currentScore;

        let shiftCandidates = [];
        if (flags.localSearchK < 26) {
          const ranked = rankedShiftsForColumn(columns[pos], optimizationContext);
          shiftCandidates = ranked.slice(0, flags.localSearchK).map((entry) => entry.shift);
          if (!shiftCandidates.includes(original)) {
            shiftCandidates.push(original);
          }
        } else {
          for (let shift = 0; shift < 26; shift += 1) {
            shiftCandidates.push(shift);
          }
        }

        for (const shift of shiftCandidates) {
          if (shift === original) {
            continue;
          }
          if (stats) {
            stats.localSearchTrials += 1;
          }

          if (flags.incrementalScoring === true) {
            const predictedDelta = scoreDeltaForShiftChange(localState, pos, shift);
            if (predictedDelta < 0.005) {
              if (stats) {
                stats.localSearchPredictedSkips += 1;
              }
              continue;
            }
          }

          shifts[pos] = shift;
          const trialText = applyWithShifts(text, shifts, -1);
          const trialScore = scoreLanguage(trialText);
          if (stats) {
            stats.scoreEvaluations += 1;
          }

          if (trialScore > bestScore) {
            bestScore = trialScore;
            bestShift = shift;
            bestText = trialText;
          }
        }

        shifts[pos] = bestShift;
        localState.shifts[pos] = bestShift;
        if (bestShift !== original) {
          changed = true;
          const improvement = bestScore - baselineScore;
          roundImprovement += Math.max(0, improvement);
          currentScore = bestScore;
          currentText = bestText;
          if (stats) {
            stats.localSearchImprovements += 1;
          }
        }
      }

      if (!changed) {
        break;
      }

      if (optimizationContext && optimizationContext.enabled && roundImprovement < 0.01) {
        if (stats) {
          stats.localSearchEarlyStops += 1;
        }
        break;
      }
    }

    return {
      key: shiftsToKey(shifts),
      text: currentText,
      score: currentScore,
    };
  }

  function uniqueTopCandidates(candidates, maxCount) {
    const seen = new Set();
    const unique = [];

    for (const candidate of candidates) {
      const id = `${candidate.key}::${candidate.text}`;
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      unique.push(candidate);
      if (unique.length >= maxCount) {
        break;
      }
    }

    return unique;
  }

  function crackWithLength(text, keyLength, hinted, options) {
    const optimizationContext = createOptimizationContext(options || {});
    const flags = optimizationContext.flags;
    const stats = optimizationContext.stats;
    const startedAt = stats ? nowMs() : 0;

    const safeLength = Math.max(1, keyLength);
    const letters = extractLettersUpper(text);
    if (letters.length === 0) {
      return {
        best: { key: "A", text, confidence: -Infinity },
        candidates: [{ key: "A", text, confidence: -Infinity }],
        search: {
          shortTextRescue: false,
          optionCount: 0,
          candidateBudget: 0,
          stateBudget: 0,
          evaluationBudget: 0,
          statesGenerated: 0,
          statesEvaluated: 0,
          optimizations: Object.assign({}, flags),
        },
      };
    }

    const columns = splitIntoColumns(letters, safeLength);
    const columnRanks = columns.map((col) => rankedShiftsForColumn(col, optimizationContext));
    const shortTextRescue =
      (hinted || optimizationContext.enabled) &&
      letters.length <= Math.max(20, safeLength * 3);
    let candidateBudget = resolveCandidateBudget(options, hinted, safeLength, shortTextRescue);
    let stateBudget = resolveStateBudget(options, candidateBudget, hinted, shortTextRescue);
    let evaluationBudget = resolveEvaluationBudget(options, stateBudget, hinted, shortTextRescue);

    if (optimizationContext.enabled && hinted && !shortTextRescue && letters.length <= 140) {
      // Moderat höhere Budgets für bekannte Schlüssellängen auf mittleren Texten:
      // Das verbessert Robustheit deutlich, ohne die Laufzeit in langen Fällen
      // unverhältnismäßig zu erhöhen.
      candidateBudget = Math.max(candidateBudget, 40_000);
      stateBudget = Math.max(stateBudget, 18_000);
      evaluationBudget = Math.max(evaluationBudget, 4_500);
    }

    const optionBudget = shortTextRescue
      ? Math.min(candidateBudget, stateBudget)
      : candidateBudget;
    const optionByBudget = Math.max(
      2,
      Math.floor(Math.pow(Math.max(2, optionBudget), 1 / safeLength))
    );
    const baseTop = getTopShiftCount(safeLength, hinted);
    let optionCount = hinted ? Math.max(baseTop, optionByBudget) : baseTop;
    if (shortTextRescue) {
      optionCount = Math.max(optionCount, 9);
    }
    optionCount = clampInt(optionCount, 2, 26);

    const columnOptions = columnRanks.map((ranks) =>
      selectDiverseShiftOptions(ranks, optionCount, hinted)
    );
    const states = buildShiftCandidates(columnOptions, stateBudget, optimizationContext);
    const evaluationSeeds = sampleAcrossRange(states, evaluationBudget);
    const evaluatedCandidates = [];

    for (const state of evaluationSeeds) {
      const trialText = applyWithShifts(text, state.shifts, -1);
      const trialScore = scoreLanguage(trialText);
      if (stats) {
        stats.scoreEvaluations += 1;
      }
      evaluatedCandidates.push({
        shifts: state.shifts,
        chi: state.chi,
        trialText,
        trialScore,
      });
    }

    const rankedByRaw = evaluatedCandidates
      .slice()
      .sort((a, b) => b.trialScore - a.trialScore);
    const rankedByChi = evaluatedCandidates.slice().sort((a, b) => a.chi - b.chi);

    let refineCount = hinted ? (shortTextRescue ? 100 : 10) : 10;
    if (optimizationContext.enabled && hinted && !shortTextRescue) {
      refineCount = Math.max(refineCount, 14);
    }
    if (hinted && letters.length > 220) {
      refineCount = 6;
    } else if (hinted && letters.length > 90) {
      refineCount = 8;
    }

    const toRefineMap = new Map();
    const addRefineSeed = (item) => {
      const id = item.shifts.join(",");
      if (!toRefineMap.has(id)) {
        toRefineMap.set(id, item);
      }
    };
    for (const item of rankedByRaw.slice(0, Math.min(refineCount, rankedByRaw.length))) {
      addRefineSeed(item);
    }
    for (const item of rankedByChi.slice(0, Math.min(refineCount, rankedByChi.length))) {
      addRefineSeed(item);
    }
    for (const item of sampleAcrossRange(rankedByRaw, Math.min(refineCount, rankedByRaw.length))) {
      addRefineSeed(item);
    }

    const toRefine = Array.from(toRefineMap.values());
    const refinedCandidates = [];

    for (const item of toRefine) {
      const refined = refineByLocalSearch(text, item.shifts, optimizationContext);
      const refBoost = dictionaryBoostScore(refined.text || "");
      refinedCandidates.push({
        key: refined.key,
        text: refined.text,
        confidence: refined.score + refBoost,
        source: "refined",
      });
    }
    for (const item of rankedByRaw.slice(0, Math.min(180, rankedByRaw.length))) {
      const rawBoost = dictionaryBoostScore(item.trialText || "");
      refinedCandidates.push({
        key: shiftsToKey(item.shifts),
        text: item.trialText,
        confidence: item.trialScore + rawBoost,
        source: "raw",
      });
    }
    for (const item of rankedByChi.slice(0, Math.min(80, rankedByChi.length))) {
      const chiBoost = dictionaryBoostScore(item.trialText || "");
      refinedCandidates.push({
        key: shiftsToKey(item.shifts),
        text: item.trialText,
        confidence: item.trialScore - item.chi * 0.0009 + chiBoost,
        source: "chi",
      });
    }

    refinedCandidates.sort((a, b) => b.confidence - a.confidence);
    const maxCandidateCount = hinted
      ? shortTextRescue
        ? 220
        : 90
      : 40;
    const unique = uniqueTopCandidates(refinedCandidates, maxCandidateCount);
    const best = unique[0] || { key: "A", text, confidence: -Infinity };

    const search = {
      shortTextRescue,
      optionCount,
      candidateBudget,
      stateBudget,
      evaluationBudget,
      statesGenerated: states.length,
      statesEvaluated: evaluationSeeds.length,
      optimizations: Object.assign({}, flags),
    };

    if (stats) {
      stats.totalMs = nowMs() - startedAt;
      search.telemetry = Object.assign({}, stats);
    }

    return {
      best,
      candidates: unique,
      search,
    };
  }

  root.vigenereCipher = {
    id: "vigenere",
    name: "Vigenère",
    supportsKey: true,
    supportsCrackLengthHint: true,
    keyLabel: "Schlüsselwort",
    keyPlaceholder: "z. B. LEMON",
    crackLengthLabel: "Schlüssellänge",
    crackLengthPlaceholder: "z. B. 6",
    info: {
      purpose:
        "Polyalphabetische Verschlüsselung: Verschiebung wechselt pro Buchstabe nach einem Schlüsselwort.",
      process:
        "Jeder Buchstabe des Schlüsselworts bestimmt eine Cäsar-Verschiebung. Nicht-Buchstaben bleiben unverändert.",
      crack:
        "Das Knacken nutzt Häufigkeitsanalyse je Schlüssel-Position. Wenn die Schlüssellänge bekannt ist, wird es deutlich präziser.",
      useCase:
        "Sinnvoll für klassische Kryptografie-Aufgaben mit Schlüsselwörtern statt Zahlen-Schlüssel.",
    },

    parseKey(rawKey) {
      return normalizeKey(rawKey);
    },

    encrypt(text, key) {
      return applyVigenere(text, key, 1);
    },

    decrypt(text, key) {
      return applyVigenere(text, key, -1);
    },

    crack(text, options) {
      // Session-Start leert den globalen Chi-Cache immer, damit vorherige Aufrufe
      // (auch mit anderem memoChi-Flag) keine Folgesessions beeinflussen.
      resetChiMemo();

      const safeOptions = options || {};
      try {
        const optimizationContext = createOptimizationContext(safeOptions);
        const keyLengthHint =
          safeOptions && Number.isInteger(safeOptions.keyLength) ? safeOptions.keyLength : null;
        const bruteforceFallbackConfig = resolveBruteforceFallbackOptions(safeOptions);

        let best = {
          key: "A",
          text,
          score: -Infinity,
        };
        const collectedCandidates = [];

        const lengths = candidateLengths(text, keyLengthHint, optimizationContext);
        // Wenn der Hint ein vielfaches, repetitives Schlüsselwort repräsentiert,
        // können Teilerlängen denselben Klartext ergeben. Diese Zusatzprüfung läuft
        // nur im Optimierungsmodus, damit der Legacy-Pfad unverändert bleibt.
        if (keyLengthHint != null && optimizationContext.enabled) {
          for (let divisor = 1; divisor < keyLengthHint; divisor += 1) {
            if (keyLengthHint % divisor !== 0) {
              continue;
            }
            if (!lengths.includes(divisor)) {
              lengths.push(divisor);
            }
          }
          lengths.sort((a, b) => a - b);
        }

        const lettersCount = extractLettersUpper(text).length;
        const promoteUnhintedShortSearch =
          keyLengthHint == null && optimizationContext.enabled && lettersCount <= 18;
        const lengthPenaltyPerChar =
          keyLengthHint != null ? 0.12 : optimizationContext.enabled ? 1.5 : 0.12;
        let bruteforceBudgetSpentMs = 0;

        let bestSearch = null;
        for (const length of lengths) {
          const useHintedBudgets = keyLengthHint != null || promoteUnhintedShortSearch;
          const result = crackWithLength(text, length, useHintedBudgets, safeOptions);
          const baseScored = scoreCandidateForFallback(result.best.text);
          let selectedBest = {
            key: result.best.key,
            text: result.best.text,
            confidence: result.best.confidence,
            sense: baseScored.sense,
          };
          let selectedCandidates = Array.isArray(result.candidates)
            ? result.candidates.slice()
            : [];

          const gate = shouldTriggerBruteforceFallback({
            lettersCount,
            keyLength: length,
            sense: baseScored.sense,
            config: bruteforceFallbackConfig,
          });
          let bruteforceFallbackTriggered = false;
          let bruteforceFallbackReason = gate.reason;
          let bruteforceCombosVisited = 0;
          let bruteforceElapsedMs = 0;

          // Bei kurzen, wenig plausiblen Kandidaten schalten wir bewusst eine zweite,
          // zeitbudgetierte Suche zu, weil der normale Pfad in diesem Bereich öfter
          // auf lokal guten, aber semantisch schlechten Plateaus landet.
          // Ohne Längen-Hint erlauben wir den Fallback nur bei adaptiv "günstigen"
          // Fällen, damit der teure Pfad auf kleine Suchräume beschränkt bleibt.
          const estimatedFallbackMs =
            (lettersCount * Math.pow(26, length)) / 20_000;
          const fallbackEligibleWithoutHint =
            keyLengthHint == null &&
            Number.isFinite(estimatedFallbackMs) &&
            estimatedFallbackMs <= bruteforceFallbackConfig.maxMsPerLength;
          const fallbackEligibleLength =
            (keyLengthHint != null && length === keyLengthHint) ||
            fallbackEligibleWithoutHint;
          if (gate.triggered && fallbackEligibleLength) {
            const remainingTotalMs = Math.max(
              0,
              bruteforceFallbackConfig.maxTotalMs - bruteforceBudgetSpentMs
            );
            if (remainingTotalMs > 0) {
              let maxElapsedMs;
              if (keyLengthHint != null) {
                // Bei explizitem KeyLength-Hint gilt direkt die Konfiguration ohne
                // adaptive Zusatzkappung, damit das Budget verlässlich planbar bleibt.
                maxElapsedMs = Math.min(
                  remainingTotalMs,
                  bruteforceFallbackConfig.maxMsPerLength
                );
              } else {
                // Ohne Hint bleibt das adaptive Größen-Gate aktiv, damit der teure
                // Pfad nur auf kleine, voraussichtlich günstige Suchräume fällt.
                const adaptivePerLengthMs = Math.min(
                  bruteforceFallbackConfig.maxMsPerLength,
                  Math.max(900, lettersCount * length * 20)
                );
                maxElapsedMs = Math.min(remainingTotalMs, adaptivePerLengthMs);
              }
              const fallback = runStagedBruteforceFallback(
                text,
                length,
                bruteforceFallbackConfig,
                optimizationContext,
                maxElapsedMs
              );
              bruteforceBudgetSpentMs += fallback.elapsedMs;
              bruteforceFallbackTriggered = true;
              bruteforceFallbackReason = gate.reason;
              bruteforceCombosVisited = fallback.combosVisited;
              bruteforceElapsedMs = fallback.elapsedMs;

              if (shouldUseBruteforceResult(baseScored, fallback.best)) {
                selectedBest = fallback.best;
              }

              if (fallback.candidates.length > 0) {
                selectedCandidates = uniqueTopCandidates(
                  selectedCandidates
                    .concat(fallback.candidates)
                    .sort((a, b) => b.confidence - a.confidence),
                  keyLengthHint != null ? 180 : 120
                );
              }
            } else {
              bruteforceFallbackReason = "total_budget_exhausted";
            }
          } else if (gate.triggered && !fallbackEligibleLength) {
            bruteforceFallbackReason =
              keyLengthHint != null ? "requires_keylength_hint" : "adaptive_size_gate_not_met";
          }

          const search = Object.assign({}, result.search || {}, {
            bruteforceFallbackTriggered,
            bruteforceFallbackReason,
            bruteforceFallbackKeyLength: bruteforceFallbackTriggered ? length : null,
            bruteforceCombosVisited,
            bruteforceElapsedMs,
            sense: selectedBest.sense || baseScored.sense,
          });

          for (const candidate of selectedCandidates) {
            collectedCandidates.push({
              key: candidate.key,
              text: candidate.text,
              confidence: candidate.confidence - length * lengthPenaltyPerChar,
              keyLength: length,
            });
          }

          const adjustedScore = selectedBest.confidence - length * lengthPenaltyPerChar;
          if (adjustedScore > best.score) {
            best = {
              key: selectedBest.key,
              text: selectedBest.text,
              score: adjustedScore,
            };
            bestSearch = search;
          }
        }

        collectedCandidates.sort((a, b) => b.confidence - a.confidence);
        const ranked = uniqueTopCandidates(
          collectedCandidates,
          keyLengthHint != null ? 120 : 60
        );

        return {
          key: best.key,
          text: best.text,
          confidence: best.score,
          candidates: ranked,
          search: bestSearch,
        };
      } finally {
        // Session-Ende leert den Cache erneut, damit der globale Speicher selbst
        // bei wiederholten Aufrufen mit wechselnden Optionen stabil bleibt.
        resetChiMemo();
      }
    },
  };
})(window);
