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

  function extractStringFromJson(value, depth) {
    if (depth > 8 || value == null) {
      return null;
    }

    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }

    if (Array.isArray(value)) {
      const parts = value
        .map((entry) => extractStringFromJson(entry, depth + 1))
        .filter(Boolean);
      return parts.length > 0 ? parts.join("\n") : null;
    }

    if (typeof value === "object") {
      const preferredKeys = ["text", "message", "ciphertext", "content", "data"];
      for (const key of preferredKeys) {
        if (key in value) {
          const found = extractStringFromJson(value[key], depth + 1);
          if (found) {
            return found;
          }
        }
      }

      for (const key of Object.keys(value)) {
        const found = extractStringFromJson(value[key], depth + 1);
        if (found) {
          return found;
        }
      }
    }

    return null;
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
        const extracted = extractStringFromJson(parsed, 0);
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
