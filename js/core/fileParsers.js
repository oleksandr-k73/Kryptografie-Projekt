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

  function scoreJsonCandidate(candidate) {
    const text = candidate.text;
    const lowerText = text.toLowerCase();
    const keyPath = candidate.path.join(".").toLowerCase();
    const lastKey = (candidate.path.at(-1) || "").toLowerCase();

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

        const header = rows[0].map((cell) => cell.toLowerCase());
        const textColumn = header.findIndex((h) =>
          ["text", "message", "ciphertext", "content"].includes(h)
        );

        if (textColumn >= 0) {
          return rows
            .slice(1)
            .map((row) => row[textColumn] ?? "")
            .join("\n")
            .trim();
        }

        return rows
          .flatMap((row) => row)
          .join(" ")
          .trim();
      },
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
