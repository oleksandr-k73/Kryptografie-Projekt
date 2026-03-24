(function initBase64Cipher(global) {
  const root = global.KryptoCiphers || (global.KryptoCiphers = {});

  const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const BASE64_LOOKUP = new Array(256).fill(-1);

  // Lookup-Table haelt das Decoding konstant schnell und vermeidet wiederholtes indexOf im Hot-Path.
  for (let index = 0; index < BASE64_ALPHABET.length; index += 1) {
    BASE64_LOOKUP[BASE64_ALPHABET.charCodeAt(index)] = index;
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

  function normalizeBase64Input(text) {
    const compact = String(text || "")
      .replace(/\s+/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    if (!compact) {
      return "";
    }

    if (/[^A-Za-z0-9+/=]/.test(compact)) {
      throw new Error("Base64-Eingabe enthält ungültige Zeichen.");
    }

    const firstPadding = compact.indexOf("=");
    if (firstPadding !== -1 && /[^=]/.test(compact.slice(firstPadding))) {
      // Padding darf nur am Ende stehen, sonst sind die Byte-Gruppen nicht mehr rekonstruierbar.
      throw new Error("Base64-Padding ist ungültig.");
    }

    const remainder = compact.length % 4;
    if (remainder === 1) {
      throw new Error("Base64-Eingabe hat eine ungültige Länge (mod 4 = 1).");
    }

    let padded = compact;
    if (remainder === 2) {
      padded += "==";
    } else if (remainder === 3) {
      padded += "=";
    }

    const padCount = padded.endsWith("==") ? 2 : padded.endsWith("=") ? 1 : 0;
    if (padCount > 0 && padded.slice(0, -padCount).includes("=")) {
      // Mehrere Padding-Positionen deuten auf kaputte Chunks hin; wir brechen klar ab.
      throw new Error("Base64-Padding ist ungültig.");
    }

    return padded;
  }

  function encodeBase64(bytes) {
    const source = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes || []);
    let output = "";

    for (let index = 0; index < source.length; index += 3) {
      const byte1 = source[index];
      const byte2 = source[index + 1];
      const byte3 = source[index + 2];

      const triple =
        (byte1 << 16) | ((byte2 == null ? 0 : byte2) << 8) | (byte3 == null ? 0 : byte3);

      output += BASE64_ALPHABET[(triple >> 18) & 0x3f];
      output += BASE64_ALPHABET[(triple >> 12) & 0x3f];
      output += byte2 == null ? "=" : BASE64_ALPHABET[(triple >> 6) & 0x3f];
      output += byte3 == null ? "=" : BASE64_ALPHABET[triple & 0x3f];
    }

    return output;
  }

  function decodeBase64ToBytes(text) {
    const normalized = normalizeBase64Input(text);
    if (!normalized) {
      return new Uint8Array(0);
    }

    const bytes = [];

    for (let index = 0; index < normalized.length; index += 4) {
      const char1 = normalized[index];
      const char2 = normalized[index + 1];
      const char3 = normalized[index + 2];
      const char4 = normalized[index + 3];

      if (char1 === "=" || char2 === "=") {
        // Padding darf nur in den letzten zwei Slots auftreten, sonst verliert man Bits.
        throw new Error("Base64-Padding ist ungültig.");
      }

      const sextet1 = BASE64_LOOKUP[char1.charCodeAt(0)];
      const sextet2 = BASE64_LOOKUP[char2.charCodeAt(0)];
      const sextet3 = char3 === "=" ? 64 : BASE64_LOOKUP[char3.charCodeAt(0)];
      const sextet4 = char4 === "=" ? 64 : BASE64_LOOKUP[char4.charCodeAt(0)];

      if (sextet1 < 0 || sextet2 < 0 || sextet3 < 0 || sextet4 < 0) {
        throw new Error("Base64-Eingabe enthält ungültige Zeichen.");
      }

      if (char3 === "=" && char4 !== "=") {
        // Ein einzelnes '=' in Slot 3 ist ungueltig; Base64 verliert dann Byte-Grenzen.
        throw new Error("Base64-Padding ist ungültig.");
      }

      const triple = (sextet1 << 18) | (sextet2 << 12) | ((sextet3 & 0x3f) << 6) | (sextet4 & 0x3f);
      bytes.push((triple >> 16) & 0xff);

      if (char3 !== "=") {
        bytes.push((triple >> 8) & 0xff);
      }

      if (char4 !== "=") {
        bytes.push(triple & 0xff);
      }
    }

    return Uint8Array.from(bytes);
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
      } else if (/[.,;:!?'"()\-]/.test(ch)) {
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
      if (
        displayText &&
        normalizeVisibleText(displayText) === normalizeVisibleText(rawText)
      ) {
        // Segmentierung ist nur dann sicher, wenn der Inhalt vollstaendig erhalten bleibt.
        result.text = displayText;
      }
    } catch (_error) {
      // Scoring-Fehler sollen das Decode nicht blockieren, daher ignorieren wir sie bewusst.
    }

    return result;
  }

  const base64Cipher = {
    id: "base64",
    name: "Base64",
    supportsKey: false,
    info: {
      purpose: "Kodiert beliebige UTF-8-Texte in Base64-Strings.",
      process: "UTF-8-Bytes werden ohne Browser-APIs in Base64 umgerechnet.",
      crack: "Kein Schlüssel: Crack dekodiert deterministisch und bewertet die Textqualität.",
      useCase: "Wenn Base64-Strings vorliegen oder Bytes als Text transportiert werden sollen.",
    },
    encrypt(text) {
      const bytes = encodeUtf8(text);
      return encodeBase64(bytes);
    },
    decrypt(text) {
      const bytes = decodeBase64ToBytes(text);
      return decodeUtf8(bytes);
    },
    crack(text) {
      const bytes = decodeBase64ToBytes(text);
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

  root.base64Cipher = base64Cipher;
})(window);
