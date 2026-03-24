(function initHexCipher(global) {
  const root = global.KryptoCiphers || (global.KryptoCiphers = {});

  const HEX_TABLE = Array.from({ length: 256 }, (_value, index) =>
    index.toString(16).padStart(2, "0").toUpperCase()
  );
  const HEX_LOOKUP = new Array(256).fill(-1);

  // Lookup-Tabellen vermeiden parseInt/RegExp im Hot-Path und halten Decode konstant schnell.
  for (let index = 0; index < 10; index += 1) {
    HEX_LOOKUP[0x30 + index] = index;
  }
  for (let index = 0; index < 6; index += 1) {
    HEX_LOOKUP[0x41 + index] = 10 + index;
    HEX_LOOKUP[0x61 + index] = 10 + index;
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

  function normalizeHexInput(text) {
    const compact = String(text || "").replace(/\s+/g, "");

    if (!compact) {
      return "";
    }

    if (compact.length % 2 !== 0) {
      throw new Error("HEX-Eingabe muss eine gerade Länge haben.");
    }

    return compact;
  }

  function bytesToHex(bytes) {
    let output = "";
    for (const byte of bytes) {
      output += HEX_TABLE[byte];
    }
    return output;
  }

  function hexToBytes(text) {
    const normalized = normalizeHexInput(text);

    if (!normalized) {
      return new Uint8Array(0);
    }

    const bytes = new Uint8Array(normalized.length / 2);
    for (let index = 0; index < normalized.length; index += 2) {
      const high = HEX_LOOKUP[normalized.charCodeAt(index)];
      const low = HEX_LOOKUP[normalized.charCodeAt(index + 1)];

      if (high < 0 || low < 0) {
        // Fehler bleibt eindeutig, damit UI-Meldungen auf klare HEX-Probleme zeigen.
        throw new Error("HEX-Eingabe darf nur 0-9 und A-F enthalten.");
      }

      bytes[index / 2] = (high << 4) | low;
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
    // Whitespace-neutraler Vergleich verhindert, dass Segmentierung Zeichen verliert.
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

  const hexCipher = {
    id: "hex",
    name: "HEX (UTF-8)",
    supportsKey: false,
    info: {
      purpose: "Kodiert UTF-8-Text als HEX-String ohne Separatoren.",
      process: "UTF-8-Bytes werden in zweistellige HEX-Paare umgerechnet.",
      crack: "Kein Schlüssel: Crack dekodiert deterministisch und bewertet die Textqualität.",
      useCase: "Wenn Bytefolgen als HEX vorliegen oder HEX-Dumps geprüft werden sollen.",
    },
    encrypt(text) {
      const bytes = encodeUtf8(text);
      return bytesToHex(bytes);
    },
    decrypt(text) {
      const bytes = hexToBytes(text);
      return decodeUtf8(bytes);
    },
    crack(text) {
      const bytes = hexToBytes(text);
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

  root.hexCipher = hexCipher;
})(window);
