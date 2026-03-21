(function initAsciiCipher(global) {
  const root = global.KryptoCiphers || (global.KryptoCiphers = {});

  function getDictionaryScorer() {
    const core = global.KryptoCore;
    return core && core.dictionaryScorer ? core.dictionaryScorer : null;
  }

  function normalizeVisibleText(text) {
    // Whitespace-neutraler Vergleich verhindert, dass Segmentierung Zeichen stillschweigend entfernt.
    return String(text || "").replace(/\s+/g, "");
  }

  function fallbackConfidence(text) {
    const source = String(text || "");
    if (!source) {
      return 0;
    }

    const lower = ` ${source.toLowerCase()} `;
    const commonWords = [
      " der ",
      " die ",
      " und ",
      " ist ",
      " nicht ",
      " ein ",
      " the ",
      " and ",
      " of ",
      " to ",
    ];

    let score = 0;
    for (const word of commonWords) {
      if (lower.includes(word)) {
        score += 2.5;
      }
    }

    let letters = 0;
    let spaces = 0;
    let digits = 0;
    let punctuation = 0;
    let controls = 0;
    let replacements = 0;

    for (const ch of source) {
      const code = ch.charCodeAt(0);
      if (ch === " ") {
        spaces += 1;
      }
      if (/[A-Za-zÄÖÜäöüß]/.test(ch)) {
        letters += 1;
      } else if (/[0-9]/.test(ch)) {
        digits += 1;
      } else if (/[.,;:!?"'()\-]/.test(ch)) {
        punctuation += 1;
      }
      if (code < 0x20 && ch !== "\n" && ch !== "\r" && ch !== "\t") {
        controls += 1;
      }
      if (ch === "\uFFFD") {
        // Replacement-Zeichen signalisiert fehlerhafte Dekodierungen und soll den Score senken.
        replacements += 1;
      }
    }

    const length = source.length;
    const printableRatio = (length - controls) / length;

    score += (letters / length) * 8;
    score += (spaces / length) * 4;
    score += (digits / length) * 1;
    score += (punctuation / length) * 0.6;
    score += printableRatio * 2;
    score -= (controls / length) * 12;
    score -= (replacements / length) * 8;

    return score;
  }

  function analyzeDecodedText(rawText) {
    const result = {
      text: rawText,
      rawText,
      confidence: fallbackConfidence(rawText),
    };

    const scorer = getDictionaryScorer();
    if (!scorer || typeof scorer.analyzeTextQuality !== "function") {
      return result;
    }

    try {
      const analysis = scorer.analyzeTextQuality(rawText, {
        languageHints: ["de", "en"],
        maxWordLength: 40,
      });
      const displayText =
        analysis && typeof analysis.displayText === "string"
          ? analysis.displayText.trim()
          : "";
      const qualityScore = Number(analysis && analysis.qualityScore) || 0;
      const coverage = Number(analysis && analysis.coverage) || 0;
      const meaningfulTokenRatio = Number(analysis && analysis.meaningfulTokenRatio) || 0;
      const computedConfidence = qualityScore + coverage * 12 + meaningfulTokenRatio * 6;

      if (Number.isFinite(computedConfidence)) {
        result.confidence = computedConfidence;
      }
      if (
        displayText &&
        normalizeVisibleText(displayText) === normalizeVisibleText(rawText)
      ) {
        // Segmentierung wird nur übernommen, wenn der sichtbare Inhalt unverändert bleibt.
        result.text = displayText;
      }
    } catch (_error) {
      // Scoring-Fehler dürfen das Dekodieren nicht blockieren, damit Crack stabil bleibt.
    }

    return result;
  }

  function encodeAsciiDecimal(text) {
    const source = String(text || "");
    const codes = [];

    for (let index = 0; index < source.length; index += 1) {
      const code = source.charCodeAt(index);
      if (code > 255) {
        // ASCII-Dezimalcodes bleiben auf 0..255 begrenzt, damit Decode eindeutig bleibt.
        throw new Error("Text enthält Zeichen außerhalb des ASCII-Bereichs (0 bis 255).");
      }
      codes.push(String(code));
    }

    return codes.join(" ");
  }

  function parseAsciiDecimalInput(text) {
    const source = String(text || "");

    if (!source.trim()) {
      return [];
    }

    if (/[^\d\s]/.test(source)) {
      // UI-Fehler soll klar auf nicht-numerische Eingaben hinweisen.
      throw new Error("Eingabe darf nur Zahlen und Leerzeichen enthalten.");
    }

    const tokens = source.trim().split(/\s+/g);
    const codes = [];

    for (const token of tokens) {
      const value = Number.parseInt(token, 10);
      if (!Number.isFinite(value) || value < 0 || value > 255) {
        // Harte Range-Checks verhindern, dass undefinierte ASCII-Bytes entstehen.
        throw new Error("Zahlen müssen im Bereich 0 bis 255 liegen.");
      }
      codes.push(value);
    }

    return codes;
  }

  function decodeAsciiDecimal(text) {
    const codes = parseAsciiDecimalInput(text);
    if (codes.length === 0) {
      return "";
    }

    let output = "";
    for (const code of codes) {
      output += String.fromCharCode(code);
    }
    return output;
  }

  const asciiCipher = {
    id: "ascii",
    name: "ASCII (Dezimalcodes)",
    supportsKey: false,
    info: {
      purpose: "Codiert jeden Buchstaben als ASCII-Dezimalzahl (0–255).",
      process: "Beim Entschlüsseln werden whitespace-separierte Dezimalwerte zurück in Zeichen gewandelt.",
      crack: "Kein Schlüssel: Crack dekodiert deterministisch und bewertet die Textqualität.",
      useCase: "Sinnvoll, wenn Zahlenfolgen als ASCII-Codes vorliegen.",
    },
    encrypt(text) {
      return encodeAsciiDecimal(text);
    },
    decrypt(text) {
      return decodeAsciiDecimal(text);
    },
    crack(text) {
      const decoded = decodeAsciiDecimal(text);
      const analyzed = analyzeDecodedText(decoded);

      return {
        key: null,
        text: analyzed.text,
        rawText: analyzed.rawText,
        confidence: analyzed.confidence,
      };
    },
  };

  root.asciiCipher = asciiCipher;
})(window);
