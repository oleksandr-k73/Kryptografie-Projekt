(function initBinaryCipher(global) {
  const root = global.KryptoCiphers || (global.KryptoCiphers = {});

  const BINARY_TABLE = Array.from({ length: 256 }, (_value, index) =>
    index.toString(2).padStart(8, "0")
  );
  const BINARY_TO_BYTE = Object.create(null);

  // Lookup-Tabellen vermeiden wiederholtes toString/parseInt im Hot-Path und halten Decode stabil.
  for (let index = 0; index < BINARY_TABLE.length; index += 1) {
    BINARY_TO_BYTE[BINARY_TABLE[index]] = index;
  }

  function getDictionaryScorer() {
    const core = global.KryptoCore;
    return core && core.dictionaryScorer ? core.dictionaryScorer : null;
  }

  function encodeUtf8(text) {
    const source = String(text || "");

    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(source);
    }

    if (typeof Buffer !== "undefined") {
      // Node-Fallback: Tests laufen im VM-Kontext ohne Browser-Encoder.
      return Uint8Array.from(Buffer.from(source, "utf8"));
    }

    // Letzter Fallback haelt UTF-8-Bytes stabil, wenn Browser-APIs fehlen.
    const encoded = unescape(encodeURIComponent(source));
    const bytes = new Uint8Array(encoded.length);
    for (let index = 0; index < encoded.length; index += 1) {
      bytes[index] = encoded.charCodeAt(index);
    }
    return bytes;
  }

  function decodeUtf8(bytes) {
    const source = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes || []);

    if (typeof TextDecoder !== "undefined") {
      return new TextDecoder("utf-8", { fatal: false }).decode(source);
    }

    if (typeof Buffer !== "undefined") {
      // Node-Fallback: So bleiben Tests ohne DOM-Decoder funktionsfaehig.
      return Buffer.from(source).toString("utf8");
    }

    let binary = "";
    for (const byte of source) {
      binary += String.fromCharCode(byte);
    }

    try {
      return decodeURIComponent(escape(binary));
    } catch (_error) {
      // Wenn die Bytes kein valides UTF-8 bilden, geben wir die Rohdarstellung zurueck.
      return binary;
    }
  }

  function normalizeBinaryInput(text) {
    const compact = String(text || "").replace(/\s+/g, "");

    if (!compact) {
      return "";
    }

    if (/[^01]/.test(compact)) {
      throw new Error("Binärcode-Eingabe darf nur 0 und 1 enthalten.");
    }

    if (compact.length % 8 !== 0) {
      // Byte-Gruppen muessen vollstaendig sein, sonst ist der Klartext nicht rekonstruierbar.
      throw new Error("Binärcode-Eingabe muss aus 8-Bit-Gruppen bestehen.");
    }

    return compact;
  }

  function encodeBinary(bytes) {
    const source = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes || []);
    let output = "";

    for (let index = 0; index < source.length; index += 1) {
      if (index > 0) {
        output += " ";
      }
      output += BINARY_TABLE[source[index]];
    }

    return output;
  }

  function decodeBinaryToBytes(text) {
    const normalized = normalizeBinaryInput(text);
    if (!normalized) {
      return new Uint8Array(0);
    }

    const bytes = new Uint8Array(normalized.length / 8);
    for (let index = 0; index < normalized.length; index += 8) {
      const chunk = normalized.slice(index, index + 8);
      const value = BINARY_TO_BYTE[chunk];

      if (value == null) {
        // Fehler bleibt eindeutig, damit UI-Meldungen auf klare Binärprobleme zeigen.
        throw new Error("Binärcode-Eingabe enthält ungültige 8-Bit-Gruppen.");
      }

      bytes[index / 8] = value;
    }

    return bytes;
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
        // Replacement-Zeichen signalisiert fehlerhafte UTF-8-Dekodierung.
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

  function normalizeVisibleText(text) {
    // Whitespace-neutraler Vergleich verhindert, dass Segmentierung Ziffern/Zeichen stillschweigend entfernt.
    return String(text || "").replace(/\s+/g, "");
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
      if (displayText && normalizeVisibleText(displayText) === normalizeVisibleText(rawText)) {
        // Segmentierung ist nur dann sicher, wenn der Inhalt vollstaendig erhalten bleibt.
        result.text = displayText;
      }
    } catch (_error) {
      // Scoring-Fehler sollen das Decode nicht blockieren, daher ignorieren wir sie bewusst.
    }

    return result;
  }

  const binaryCipher = {
    id: "binary-8bit",
    name: "Binärcode (8-Bit)",
    supportsKey: false,
    keyPlaceholder: "Nicht benötigt",
    info: {
      purpose: "Kodiert UTF-8-Text in 8-Bit-Binärcode-Gruppen mit Leerzeichen.",
      process: "UTF-8-Bytes werden in 8-Bit-Blöcke umgesetzt und als 0/1-Folgen ausgegeben.",
      crack: "Kein Schlüssel: Crack dekodiert deterministisch und bewertet die Textqualität.",
      useCase: "Wenn Binärcode vorliegt oder Bytes als 0/1-String transportiert werden sollen.",
    },
    encrypt(text) {
      const bytes = encodeUtf8(text);
      return encodeBinary(bytes);
    },
    decrypt(text) {
      const bytes = decodeBinaryToBytes(text);
      return decodeUtf8(bytes);
    },
    crack(text) {
      const bytes = decodeBinaryToBytes(text);
      const decoded = decodeUtf8(bytes);
      const analyzed = analyzeDecodedText(decoded);

      return {
        key: null,
        text: analyzed.text,
        rawText: analyzed.rawText,
        confidence: analyzed.confidence,
      };
    },
  };

  root.binaryCipher = binaryCipher;
})(window);
