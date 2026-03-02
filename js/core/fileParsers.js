(function initFileParsers(global) {
  const root = global.KryptoCore || (global.KryptoCore = {});

  function parseCsvLine(line) {
    const cells = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        const next = line[i + 1];
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if ((ch === "," || ch === ";" || ch === "\t") && !inQuotes) {
        cells.push(current.trim());
        current = "";
        continue;
      }

      current += ch;
    }

    cells.push(current.trim());
    return cells;
  }

  function looksLikeHash(text) {
    const compact = text.replace(/\s+/g, "");
    return /^[a-f0-9]{24,}$/i.test(compact);
  }

  /**
   * Recursively traverses a value and collects non-empty trimmed string entries with their access paths.
   *
   * Traversal stops when depth exceeds 12 or the value is null/undefined. For each string found, a
   * candidate object { text, path } is appended to `out`, where `text` is the trimmed string and
   * `path` is an array of keys/indexes describing how to reach that string from the root value.
   *
   * @param {*} value - The value to scan (may be an object, array, string, or other).
   * @param {string[]} path - The access path to `value` from the root (array of keys/indexes).
   * @param {number} depth - Current recursion depth (used to limit traversal).
   * @param {Array<{text: string, path: string[]}>} out - Array that will be populated with found candidates.
   */
  function collectStringCandidates(value, path, depth, out) {
    if (depth > 12 || value == null) {
      return;
    }

    if (typeof value === "string") {
      const text = value.trim();
      if (text) {
        out.push({ text, path });
      }
      return;
    }

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        collectStringCandidates(value[i], path.concat(String(i)), depth + 1, out);
      }
      return;
    }

    if (typeof value === "object") {
      for (const key of Object.keys(value)) {
        collectStringCandidates(value[key], path.concat(key), depth + 1, out);
      }
    }
  }

  const strongTextKeys = [
    "coded",
    "code",
    "cipher",
    "ciphertext",
    "encrypted",
    "decoded",
    "plaintext",
    "cleartext",
    "plain",
    "text",
    "message",
    "msg",
    "payload",
    "body",
    "content",
    "input",
    "output",
    "data",
    "value",
  ];

  const weakMetaKeys = [
    "title",
    "name",
    "label",
    "level",
    "task",
    "task_type",
    "method",
    "status",
    "format",
    "hash",
    "signature",
    "checksum",
    "id",
    "version",
    "explain",
    "description",
    "hint",
  ];

  /**
   * Evaluate how likely a string candidate (with its object path) contains meaningful text.
   * Considers key names, candidate path, length, character content, and hash-like patterns to produce the score.
   * @param {{text: string, path: string[]}} candidate - Object with `text` (the candidate string) and `path` (array of keys leading to the value).
   * @returns {number} A numeric score where higher values indicate greater likelihood that `text` is a meaningful textual field.
   */
  function scoreJsonCandidate(candidate) {
    const text = candidate.text;
    const lowerText = text.toLowerCase();
    const keyPath = candidate.path.join(".").toLowerCase();
    const lastKey = (candidate.path.at(-1) || "").toLowerCase();

    let score = 0;

    for (const key of strongTextKeys) {
      if (lastKey === key) {
        score += 22;
      } else if (keyPath.includes(key)) {
        score += 8;
      }
    }

    for (const key of weakMetaKeys) {
      if (lastKey === key) {
        score -= 24;
      } else if (keyPath.includes(key)) {
        score -= 8;
      }
    }

    if (looksLikeHash(text)) {
      score -= 60;
    }

    const len = text.length;
    if (len >= 8 && len <= 1200) {
      score += 7;
    } else if (len <= 3) {
      score -= 6;
    } else if (len > 2400) {
      score -= 5;
    }

    if (/\s/.test(text)) {
      score += 2;
    }

    if (/[A-Za-zÄÖÜäöü]/.test(text)) {
      score += 3;
    }

    if (/[0-9@$|+#]/.test(text)) {
      score += 1;
    }

    if (/level\s*\d+/i.test(lowerText) || /substitution/i.test(lowerText)) {
      score -= 7;
    }

    return score;
  }

  /**
   * Selects the most likely meaningful text string from a parsed JSON value.
   *
   * Traverses the input to collect string candidates, scores each candidate for relevance, and returns the highest-scoring string or `null` if none are found.
   * @param {*} value - A JSON-parsed value (object, array, or primitive) to search for textual candidates.
   * @returns {string|null} The highest-scoring candidate text when found, otherwise `null`.
   */
  function extractBestStringFromJson(value) {
    const candidates = [];
    collectStringCandidates(value, [], 0, candidates);

    if (candidates.length === 0) {
      return null;
    }

    let best = null;
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      const score = scoreJsonCandidate(candidate);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    return best ? best.text : null;
  }

  /**
   * Decode a JavaScript string literal to its plain string value.
   *
   * Decodes escape sequences (`\uXXXX`, `\xXX`, `\n`, `\r`, `\t`, escaped quotes and backslashes`) and, for template literals, replaces `${...}` expressions with a single space, then trims the result. If `literal` is falsy or shorter than two characters, returns an empty string.
   *
   * @param {string} literal - A JavaScript string literal including its surrounding quotes or backticks.
   * @returns {string} The decoded and trimmed string value.
   */
  function decodeJsStringLiteral(literal) {
    if (!literal || literal.length < 2) {
      return "";
    }

    const quote = literal[0];
    let body = literal.slice(1, -1);

    body = body
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
        String.fromCharCode(Number.parseInt(hex, 16))
      )
      .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) =>
        String.fromCharCode(Number.parseInt(hex, 16))
      )
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");

    if (quote === "`") {
      body = body.replace(/\$\{[^}]*\}/g, " ");
    }

    return body.trim();
  }

  /**
   * Normalize a JavaScript object/property key string by decoding quoted keys to their unescaped value.
   * @param {string} rawKey - The raw key as found in source code; may be a quoted JS string or an unquoted identifier.
   * @returns {string} The normalized key: decoded and unquoted if `rawKey` was a quoted string, an empty string if `rawKey` is falsy, or `rawKey` unchanged otherwise.
   */
  function normalizeJsKey(rawKey) {
    if (!rawKey) {
      return "";
    }

    const isQuoted =
      (rawKey.startsWith('"') && rawKey.endsWith('"')) ||
      (rawKey.startsWith("'") && rawKey.endsWith("'"));

    if (isQuoted) {
      return decodeJsStringLiteral(rawKey);
    }

    return rawKey;
  }

  /**
   * Extracts the most likely meaningful string from JavaScript or TypeScript source.
   *
   * Scans assignments, object properties, and string literals, decodes candidate literals,
   * scores them by contextual heuristics, and returns the highest-scoring text.
   * @param {string} source - Source code to analyze.
   * @returns {string|null} The best candidate text if one is found, or `null` when no suitable string is detected.
   */
  function extractBestStringFromJs(source) {
    const candidates = [];
    const seen = new Set();

    function pushCandidate(text, path) {
      const normalizedText = text.trim();
      if (!normalizedText) {
        return;
      }

      const key = `${path.join(".")}::${normalizedText}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      candidates.push({ text: normalizedText, path });
    }

    const assignmentRegex =
      /\b(?:const|let|var|export\s+const|export\s+let|export\s+var)\s+([A-Za-z_$][\w$]*)\s*=\s*("([^"\\]|\\[\s\S])*"|'([^'\\]|\\[\s\S])*'|`([^`\\]|\\[\s\S])*`)/g;

    for (const match of source.matchAll(assignmentRegex)) {
      const key = match[1];
      const literal = match[2];
      pushCandidate(decodeJsStringLiteral(literal), [key]);
    }

    const propertyRegex =
      /(?:^|[,{]\s*)([A-Za-z_$][\w$]*|"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*')\s*:\s*("([^"\\]|\\[\s\S])*"|'([^'\\]|\\[\s\S])*'|`([^`\\]|\\[\s\S])*`)/gm;

    for (const match of source.matchAll(propertyRegex)) {
      const key = normalizeJsKey(match[1]);
      const literal = match[2];
      pushCandidate(decodeJsStringLiteral(literal), [key]);
    }

    const literalRegex =
      /("([^"\\]|\\[\s\S])*"|'([^'\\]|\\[\s\S])*'|`([^`\\]|\\[\s\S])*`)/g;
    for (const match of source.matchAll(literalRegex)) {
      pushCandidate(decodeJsStringLiteral(match[1]), ["value"]);
    }

    if (candidates.length === 0) {
      return null;
    }

    let best = null;
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      const score = scoreJsonCandidate(candidate);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    return best ? best.text : null;
  }

  const parserRules = [
    {
      extensions: ["txt", "log", "md"],
      parse: (text) => text,
    },
    {
      extensions: ["json"],
      parse: (text) => {
        const parsed = JSON.parse(text);
        const extracted = extractBestStringFromJson(parsed);
        if (!extracted) {
          throw new Error("In der JSON-Datei wurde kein Textfeld gefunden.");
        }
        return extracted;
      },
    },
    {
      extensions: ["csv"],
      parse: (text) => {
        const rows = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .map(parseCsvLine);

        if (rows.length === 0) {
          return "";
        }

        // If there's only one row treat it as data (no header).
        if (rows.length === 1) {
          return rows[0].join(" ").trim();
        }

        const header = rows[0].map((cell) => cell.toLowerCase());

        // Prefer any of the strong text keys (e.g. "coded", "ciphertext", "text")
        const textColumn = header.findIndex((h) =>
          strongTextKeys.includes(h) || strongTextKeys.some((k) => h.includes(k))
        );

        if (textColumn >= 0) {
          return rows
            .slice(1)
            .map((row) => row[textColumn] ?? "")
            .join("\n")
            .trim();
        }

        // If we have multiple rows and couldn't detect a text column,
        // assume the first row is a header and only join subsequent rows.
        return rows
          .slice(1)
          .flatMap((row) => row)
          .join(" ")
          .trim();
      },
    },
    {
      extensions: ["js", "mjs", "cjs"],
      parse: (text) => extractBestStringFromJs(text) || text,
    },
  ];

  /**
   * Get the lowercase file extension from a filename.
   * @returns {string} The file extension in lowercase (without the leading dot), or an empty string if the filename has no extension.
   */
  function getExtension(fileName) {
    const parts = fileName.toLowerCase().split(".");
    return parts.length > 1 ? parts.pop() : "";
  }

  root.parseInputFile = async function parseInputFile(file) {
    const text = await file.text();
    const extension = getExtension(file.name);
    const parser = parserRules.find((rule) => rule.extensions.includes(extension));

    if (!parser) {
      return {
        text,
        format: extension || "unbekannt",
        fallback: true,
      };
    }

    return {
      text: parser.parse(text),
      format: extension,
      fallback: false,
    };
  };
})(window);
