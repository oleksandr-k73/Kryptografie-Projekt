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
  const strongTextKeySet = new Set(strongTextKeys);

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

  const genericCsvHeaderKeys = new Set([
    "col",
    "cols",
    "column",
    "columns",
    "feld",
    "felder",
    "spalte",
    "spalten",
    "header",
    "headers",
    "klasse",
    "kategorie",
    "category",
    "typ",
    "type",
    "date",
    "datum",
    "zeit",
    "time",
    "city",
    "ort",
    "land",
    "country",
  ]);

  function isNumericCsvCell(value) {
    const normalized = String(value || "")
      .trim()
      .replace(",", ".");
    return /^[-+]?\d+(\.\d+)?$/.test(normalized);
  }

  function isLikelyHeaderToken(value) {
    const token = String(value || "").trim().toLowerCase();
    if (!token || token.length > 24 || isNumericCsvCell(token)) {
      return false;
    }
    return /^[a-zäöü_][a-zäöü0-9_ -]*$/i.test(token);
  }

  function isLikelyCsvHeaderRow(rows) {
    if (!Array.isArray(rows) || rows.length < 2 || !Array.isArray(rows[0])) {
      return false;
    }

    const firstRow = rows[0];
    const secondRow = Array.isArray(rows[1]) ? rows[1] : [];
    const normalizedFirst = firstRow.map((cell) => String(cell || "").trim().toLowerCase());
    const nonEmptyTokens = normalizedFirst.filter((token) => token.length > 0);

    if (nonEmptyTokens.length === 0) {
      return false;
    }

    const keywordHits = nonEmptyTokens.filter((token) => {
      return (
        strongTextKeys.includes(token) ||
        weakMetaKeys.includes(token) ||
        genericCsvHeaderKeys.has(token)
      );
    }).length;

    const headerLikeHits = nonEmptyTokens.filter((token) => isLikelyHeaderToken(token)).length;

    let contrastHits = 0;
    for (let index = 0; index < firstRow.length; index += 1) {
      const headerCell = String(firstRow[index] || "").trim();
      const dataCell = String(secondRow[index] || "").trim();
      if (!headerCell || !dataCell) {
        continue;
      }

      const headerNumeric = isNumericCsvCell(headerCell);
      const dataNumeric = isNumericCsvCell(dataCell);
      if (!headerNumeric && dataNumeric) {
        contrastHits += 1;
        continue;
      }

      // Groß-/Kleinschreibung im Folgerow ist ein robustes Signal für "Bezeichner -> Wert".
      if (/^[a-zäöü_ -]+$/i.test(headerCell) && /^[A-ZÄÖÜ]/.test(dataCell)) {
        contrastHits += 1;
        continue;
      }

      if (
        headerCell.toLowerCase() !== dataCell.toLowerCase() &&
        headerCell.length <= 14 &&
        dataCell.length >= headerCell.length + 3
      ) {
        contrastHits += 1;
      }
    }

    // Konservativ: Wir droppen nur bei starkem Signal, um echte erste Datenzeilen
    // in headerlosen CSV-Dateien weiterhin zu erhalten.
    if (keywordHits >= 2 && headerLikeHits >= Math.ceil(nonEmptyTokens.length * 0.6)) {
      return true;
    }

    return keywordHits >= 1 && contrastHits >= 1 && headerLikeHits === nonEmptyTokens.length;
  }

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

  function decodeJsStringLiteral(literal) {
    if (!literal || literal.length < 2) {
      return "";
    }

    const quote = literal[0];
    let body = literal.slice(1, -1);

    // Ein Single-Pass verhindert Escape-Overlaps aus gestapelten replace-Aufrufen
    // (z. B. "\\n" darf nicht nachträglich als echter Newline decodieren).
    // Der Hot-Path nutzt direkten Branching-Code statt Lookup-Objekt, damit
    // Escape-Decoding ohne zusätzliche Allokation und Property-Zugriffe bleibt.
    let decoded = "";
    for (let index = 0; index < body.length; index += 1) {
      const ch = body[index];
      if (ch !== "\\") {
        decoded += ch;
        continue;
      }

      const next = body[index + 1];
      if (next == null) {
        decoded += "\\";
        continue;
      }

      if (next === "u" && /^[0-9a-fA-F]{4}$/.test(body.slice(index + 2, index + 6))) {
        decoded += String.fromCharCode(Number.parseInt(body.slice(index + 2, index + 6), 16));
        index += 5;
        continue;
      }

      if (next === "x" && /^[0-9a-fA-F]{2}$/.test(body.slice(index + 2, index + 4))) {
        decoded += String.fromCharCode(Number.parseInt(body.slice(index + 2, index + 4), 16));
        index += 3;
        continue;
      }

      switch (next) {
        case "n":
          decoded += "\n";
          index += 1;
          continue;
        case "r":
          decoded += "\r";
          index += 1;
          continue;
        case "t":
          decoded += "\t";
          index += 1;
          continue;
        case "'":
          decoded += "'";
          index += 1;
          continue;
        case '"':
          decoded += '"';
          index += 1;
          continue;
        case "\\":
          decoded += "\\";
          index += 1;
          continue;
        default:
          break;
      }

      decoded += next;
      index += 1;
    }

    body = decoded;

    if (quote === "`") {
      body = body.replace(/\$\{[^}]*\}/g, " ");
    }

    return body.trim();
  }

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
      // Literal-Fallback bleibt absichtlich neutral, damit echte Key-Signale aus Assignment/Property
      // das Ranking steuern und ein künstlicher "value"-Bonus keine Metadaten nach oben drückt.
      pushCandidate(decodeJsStringLiteral(match[1]), ["_literal"]);
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

        // Token-Exact-Matching verhindert Substring-Fehlgriffe wie "metadata" -> "data",
        // lässt aber strukturierte Header wie "cipher_text" weiterhin zuverlässig treffen.
        const textColumn = header.findIndex((h) => {
          const tokens = h
            .split(/[_\s-]+/)
            .map((token) => token.trim())
            .filter((token) => token.length > 0);
          return tokens.some((token) => strongTextKeySet.has(token));
        });

        if (textColumn >= 0) {
          return rows
            .slice(1)
            .map((row) => row[textColumn] ?? "")
            .join("\n")
            .trim();
        }

        // Ohne explizite Textspalte droppen wir die erste Zeile nur bei starker
        // Header-Evidenz; so vermeiden wir Header-Leaks, ohne headerlose CSVs zu beschädigen.
        const payloadRows = isLikelyCsvHeaderRow(rows) ? rows.slice(1) : rows;
        return payloadRows
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
