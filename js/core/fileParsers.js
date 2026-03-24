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

  function looksLikeBinaryPayload(text) {
    const compact = text.replace(/\s+/g, "");
    // Binärpayloads sollen explizit erkannt werden, damit die Hash-Heuristik hier bewusst aussetzt.
    if (compact.length < 8 || compact.length % 8 !== 0) {
      return false;
    }
    return /^[01]+$/.test(compact);
  }

  function looksLikeHash(text) {
    const compact = text.replace(/\s+/g, "");
    if (looksLikeBinaryPayload(text)) {
      // Binärpayloads dürfen nicht als Hash abgewertet werden, sonst verliert `coded` seinen Vorrang im JSON-Parser.
      return false;
    }
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
      .replace(/,/g, ".");
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

      // Reine Großschreibung im Folgerow ist zu unscharf und markiert Datenzeilen
      // wie "message,HELLO" fälschlich als Header; wir zählen daher nur stärkere Kontraste.

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

  const preferredXmlTags = [
    "coded",
    "ciphertext",
    "cipher",
    "text",
    "message",
    "payload",
    "content",
    "data",
    "body",
  ];

  function decodeXmlEntities(text) {
    return String(text || "")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
  }

  function stripXmlTags(text) {
    return decodeXmlEntities(
      String(text || "")
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, " $1 ")
        .replace(/<[^>]+>/g, " ")
    )
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractPreferredXmlText(xmlText) {
    const source = String(xmlText || "");

    for (const tag of preferredXmlTags) {
      // Das strict matching mit (?=[\\s>]) verhindert Präfix-Fehlgriffe wie
      // <codedExport>..., die sonst fälschlich als <coded> gewertet würden.
      const regex = new RegExp(
        `<${tag}(?=[\\s>])(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`,
        "gi"
      );

      let match = null;
      while ((match = regex.exec(source)) !== null) {
        const candidate = stripXmlTags(match[1]);
        if (candidate) {
          return candidate;
        }
      }
    }

    return stripXmlTags(source);
  }

  function stripYamlInlineComment(line) {
    let output = "";
    let inSingleQuotes = false;
    let inDoubleQuotes = false;
    let escaping = false;

    for (let index = 0; index < line.length; index += 1) {
      const ch = line[index];

      if (escaping) {
        output += ch;
        escaping = false;
        continue;
      }

      if (inDoubleQuotes && ch === "\\") {
        output += ch;
        escaping = true;
        continue;
      }

      if (!inDoubleQuotes && ch === "'") {
        output += ch;
        if (inSingleQuotes && line[index + 1] === "'") {
          output += "'";
          index += 1;
          continue;
        }
        inSingleQuotes = !inSingleQuotes;
        continue;
      }

      if (!inSingleQuotes && ch === '"') {
        output += ch;
        inDoubleQuotes = !inDoubleQuotes;
        continue;
      }

      if (!inSingleQuotes && !inDoubleQuotes && ch === "#") {
        const prev = line[index - 1];
        if (index === 0 || /\s/.test(prev)) {
          break;
        }
      }

      output += ch;
    }

    return output.replace(/\s+$/g, "");
  }

  function hasYamlUnsupportedFeature(content) {
    const trimmed = String(content || "").trim();
    if (!trimmed) {
      return false;
    }

    if (trimmed === "---" || trimmed === "...") {
      return true;
    }

    // Der Subset-Parser bricht bei fortgeschrittenen YAML-Features bewusst auf Raw-Text ab,
    // damit unbekannte Semantik nicht still als falsche Struktur weiterverarbeitet wird.
    return (
      /(^|[\s:[-])&[A-Za-z0-9_-]+/.test(trimmed) ||
      /(^|[\s:[-])\*[A-Za-z0-9_-]+/.test(trimmed) ||
      /(^|[\s:[-])![A-Za-z0-9!/_-]*/.test(trimmed) ||
      /^<<\s*:/.test(trimmed) ||
      /^[\[{]/.test(trimmed)
    );
  }

  function decodeYamlDoubleQuoted(text) {
    let output = "";
    for (let index = 0; index < text.length; index += 1) {
      const ch = text[index];
      if (ch !== "\\") {
        output += ch;
        continue;
      }

      const next = text[index + 1];
      if (next == null) {
        output += "\\";
        continue;
      }

      if (next === "u") {
        const hex = text.slice(index + 2, index + 6);
        if (hex.length === 4 && /^[0-9A-Fa-f]{4}$/.test(hex)) {
          output += String.fromCharCode(Number.parseInt(hex, 16));
          index += 5;
          continue;
        }
        // Bei unvollständigen/ungültigen Sequenzen bleibt der Rohtext erhalten, damit Eingaben nicht still verkürzt werden.
        if (hex.length < 4) {
          output += text.slice(index);
          break;
        }
        output += text.slice(index, index + 6);
        index += 5;
        continue;
      }

      if (next === "x") {
        const hex = text.slice(index + 2, index + 4);
        if (hex.length === 2 && /^[0-9A-Fa-f]{2}$/.test(hex)) {
          output += String.fromCharCode(Number.parseInt(hex, 16));
          index += 3;
          continue;
        }
        // Bei unvollständigen/ungültigen Sequenzen bleibt der Rohtext erhalten, damit Eingaben nicht still verkürzt werden.
        if (hex.length < 2) {
          output += text.slice(index);
          break;
        }
        output += text.slice(index, index + 4);
        index += 3;
        continue;
      }

      switch (next) {
        case "n":
          output += "\n";
          break;
        case "r":
          output += "\r";
          break;
        case "t":
          output += "\t";
          break;
        case '"':
          output += '"';
          break;
        case "\\":
          output += "\\";
          break;
        default:
          output += `\\${next}`;
          break;
      }
      index += 1;
    }
    return output;
  }

  function parseYamlScalar(rawValue) {
    const value = String(rawValue || "").trim();
    if (!value) {
      return "";
    }

    if (value.startsWith('"') && value.endsWith('"')) {
      return decodeYamlDoubleQuoted(value.slice(1, -1));
    }

    if (value.startsWith("'") && value.endsWith("'")) {
      return value.slice(1, -1).replace(/''/g, "'");
    }

    const lowerValue = value.toLowerCase();
    if (["null", "~"].includes(lowerValue)) {
      return null;
    }
    if (lowerValue === "true") {
      return true;
    }
    if (lowerValue === "false") {
      return false;
    }
    if (/^[-+]?\d+(\.\d+)?$/.test(value)) {
      return Number(value);
    }

    return value;
  }

  function findYamlColon(content) {
    let inSingleQuotes = false;
    let inDoubleQuotes = false;
    let escaping = false;

    for (let index = 0; index < content.length; index += 1) {
      const ch = content[index];

      if (escaping) {
        escaping = false;
        continue;
      }

      if (inDoubleQuotes && ch === "\\") {
        escaping = true;
        continue;
      }

      if (!inDoubleQuotes && ch === "'") {
        if (inSingleQuotes && content[index + 1] === "'") {
          index += 1;
          continue;
        }
        inSingleQuotes = !inSingleQuotes;
        continue;
      }

      if (!inSingleQuotes && ch === '"') {
        inDoubleQuotes = !inDoubleQuotes;
        continue;
      }

      if (!inSingleQuotes && !inDoubleQuotes && ch === ":") {
        return index;
      }
    }

    return -1;
  }

  function splitYamlKeyValue(content) {
    const colonIndex = findYamlColon(content);
    if (colonIndex <= 0) {
      return null;
    }

    const rawKey = content.slice(0, colonIndex).trim();
    const rawValue = content.slice(colonIndex + 1).trim();
    if (!rawKey) {
      return null;
    }

    const key =
      rawKey.startsWith('"') && rawKey.endsWith('"')
        ? decodeYamlDoubleQuoted(rawKey.slice(1, -1))
        : rawKey.startsWith("'") && rawKey.endsWith("'")
          ? rawKey.slice(1, -1).replace(/''/g, "'")
          : rawKey;

    return {
      key,
      value: rawValue,
    };
  }

  function prepareYamlLines(text) {
    const rawLines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
    const lines = [];

    for (let index = 0; index < rawLines.length; index += 1) {
      const rawLine = rawLines[index];
      if (/\t/.test(rawLine)) {
        throw new Error("yaml_tabs_not_supported");
      }

      const indentMatch = rawLine.match(/^ */);
      const indent = indentMatch ? indentMatch[0].length : 0;
      const rawContent = rawLine.slice(indent);
      const stripped = stripYamlInlineComment(rawLine);
      const content = stripped.slice(indent);
      if (!stripped.trim()) {
        // Blank-Lines bleiben erhalten, damit Block-Scalars Absatzgrenzen erkennen.
        lines.push({ indent, content: "", rawContent, lineNumber: index + 1 });
        continue;
      }

      if (hasYamlUnsupportedFeature(content)) {
        throw new Error("yaml_advanced_feature");
      }

      lines.push({
        indent,
        content,
        rawContent,
        lineNumber: index + 1,
      });
    }

    return lines;
  }

  function foldYamlBlockScalar(lines) {
    const paragraphs = [];
    let current = [];

    for (const line of lines) {
      if (line === "") {
        if (current.length > 0) {
          paragraphs.push(current.join(" "));
          current = [];
        }
        paragraphs.push("");
        continue;
      }
      current.push(line);
    }

    if (current.length > 0) {
      paragraphs.push(current.join(" "));
    }

    return paragraphs.join("\n").trimEnd();
  }

  function readYamlBlockScalar(lines, startIndex, parentIndent, style) {
    let index = startIndex;
    let blockIndent = null;
    const collected = [];

    while (index < lines.length) {
      const line = lines[index];
      // Preserve blank lines inside a block scalar: only treat a line as a
      // block terminator when it is non-blank *and* has indent <= parentIndent.
      // `prepareYamlLines` may record fully empty lines with indent 0; we do
      // not want those to prematurely terminate a block scalar. Therefore
      // only break here when `line.content` is non-empty and the indent is
      // at or above the parent boundary.
      if (line.content !== "" && line.indent <= parentIndent) {
        break;
      }

      if (blockIndent == null) {
        blockIndent = line.indent;
      }

      if (line.indent < blockIndent) {
        break;
      }

      // Block-Scalars behandeln # als Nutzdaten; wir nutzen rawContent, damit Kommentar-Strippen nicht eingreift.
      collected.push(line.rawContent);
      index += 1;
    }

    const value =
      style === "|"
        ? collected.join("\n").replace(/\n+$/g, "")
        : foldYamlBlockScalar(collected);

    return {
      value,
      nextIndex: index,
    };
  }

  function mergeYamlObject(target, source) {
    for (const key of Object.keys(source)) {
      target[key] = source[key];
    }
    return target;
  }

  // skipYamlBlankLines: advance the index past YAML lines that have no
  // meaningful content. Why: normalize YAML parsing by advancing past nodes
  // whose `.content` is empty so blank YAML lines are not treated as
  // meaningful nodes and the main parser (e.g. `parseYamlBlock`) can assume
  // the current line contains actual content. Use this helper before
  // attempting to interpret a YAML node or block. Assumes `lines` is an
  // array of objects where each element has a `.content` property (string)
  // and related metadata like `.indent` and `.lineNumber`.
  function skipYamlBlankLines(lines, startIndex) {
    let index = startIndex;
    while (index < lines.length && !lines[index].content) {
      index += 1;
    }
    return index;
  }

  function parseYamlBlock(lines, startIndex, indent) {
    let index = skipYamlBlankLines(lines, startIndex);
    if (index >= lines.length) {
      return {
        value: null,
        nextIndex: index,
      };
    }

    const current = lines[index];
    if (current.indent < indent) {
      return {
        value: null,
        nextIndex: index,
      };
    }
    if (current.indent !== indent) {
      throw new Error(`yaml_indent_mismatch:${current.lineNumber}`);
    }

    if (current.content === "-" || current.content.startsWith("- ")) {
      return parseYamlSequence(lines, index, indent);
    }

    return parseYamlMapping(lines, index, indent);
  }

  function parseYamlSequenceItem(lines, startIndex, indent) {
    const line = lines[startIndex];
    const rest = line.content.slice(1).trimStart();
    const childIndent = indent + 2;

    if (!rest) {
      const nested = parseYamlBlock(lines, startIndex + 1, childIndent);
      return {
        value: nested.value,
        nextIndex: nested.nextIndex,
      };
    }

    if (rest === "|" || rest === ">") {
      const blockScalar = readYamlBlockScalar(lines, startIndex + 1, indent, rest);
      return {
        value: blockScalar.value,
        nextIndex: blockScalar.nextIndex,
      };
    }

    const inlinePair = splitYamlKeyValue(rest);
    if (!inlinePair) {
      return {
        value: parseYamlScalar(rest),
        nextIndex: startIndex + 1,
      };
    }

    const entry = {};
    if (inlinePair.value === "|" || inlinePair.value === ">") {
      const blockScalar = readYamlBlockScalar(lines, startIndex + 1, indent, inlinePair.value);
      entry[inlinePair.key] = blockScalar.value;

      let nextIndex = blockScalar.nextIndex;
      if (nextIndex < lines.length && lines[nextIndex].indent >= childIndent) {
        const continuation = parseYamlBlock(lines, nextIndex, childIndent);
        if (continuation.value && !Array.isArray(continuation.value)) {
          mergeYamlObject(entry, continuation.value);
          nextIndex = continuation.nextIndex;
        }
      }

      return { value: entry, nextIndex };
    }

    if (inlinePair.value) {
      entry[inlinePair.key] = parseYamlScalar(inlinePair.value);
      let nextIndex = startIndex + 1;
      if (nextIndex < lines.length && lines[nextIndex].indent >= childIndent) {
        const continuation = parseYamlBlock(lines, nextIndex, childIndent);
        if (continuation.value && !Array.isArray(continuation.value)) {
          mergeYamlObject(entry, continuation.value);
          nextIndex = continuation.nextIndex;
        }
      }
      return { value: entry, nextIndex };
    }

    const nested = parseYamlBlock(lines, startIndex + 1, childIndent);
    entry[inlinePair.key] = nested.value;
    let nextIndex = nested.nextIndex;
    if (nextIndex < lines.length && lines[nextIndex].indent >= childIndent) {
      const continuation = parseYamlBlock(lines, nextIndex, childIndent);
      if (continuation.value && !Array.isArray(continuation.value)) {
        mergeYamlObject(entry, continuation.value);
        nextIndex = continuation.nextIndex;
      }
    }

    return { value: entry, nextIndex };
  }

  function parseYamlSequence(lines, startIndex, indent) {
    const items = [];
    let index = startIndex;

    while (index < lines.length) {
      const line = lines[index];
      // Skip blank YAML lines: when `line.content` is falsy we intentionally
      // advance `index` and `continue` so the parser does not emit empty
      // sequence items or mappings. This preserves parser state and
      // normalizes input before further parsing — callers can assume the
      // current `line` has meaningful `.content` after this check.
      if (!line.content) {
        index += 1;
        continue;
      }
      if (line.indent < indent) {
        break;
      }
      if (line.indent !== indent) {
        throw new Error(`yaml_sequence_indent:${line.lineNumber}`);
      }
      if (!(line.content === "-" || line.content.startsWith("- "))) {
        break;
      }

      const item = parseYamlSequenceItem(lines, index, indent);
      items.push(item.value);
      index = item.nextIndex;
    }

    return {
      value: items,
      nextIndex: index,
    };
  }

  function parseYamlMapping(lines, startIndex, indent) {
    const out = {};
    let index = startIndex;

    while (index < lines.length) {
      const line = lines[index];
      // Skip blank YAML lines: when `line.content` is falsy we intentionally
      // advance `index` and `continue` so the parser does not emit empty
      // mapping entries. This preserves parser state and normalizes input
      // before further parsing — after this check callers can assume the
      // current `line` has meaningful `.content`.
      if (!line.content) {
        index += 1;
        continue;
      }
      if (line.indent < indent) {
        break;
      }
      if (line.indent !== indent) {
        throw new Error(`yaml_mapping_indent:${line.lineNumber}`);
      }
      if (line.content === "-" || line.content.startsWith("- ")) {
        break;
      }

      const pair = splitYamlKeyValue(line.content);
      if (!pair) {
        throw new Error(`yaml_mapping_expected:${line.lineNumber}`);
      }

      if (pair.value === "|" || pair.value === ">") {
        const blockScalar = readYamlBlockScalar(lines, index + 1, indent, pair.value);
        out[pair.key] = blockScalar.value;
        index = blockScalar.nextIndex;
        continue;
      }

      if (pair.value) {
        out[pair.key] = parseYamlScalar(pair.value);
        index += 1;
        continue;
      }

      const nested = parseYamlBlock(lines, index + 1, indent + 2);
      out[pair.key] = nested.value;
      index = nested.nextIndex;
    }

    return {
      value: out,
      nextIndex: index,
    };
  }

  function parseYamlSubset(text) {
    const lines = prepareYamlLines(text);
    if (lines.length === 0) {
      return null;
    }

    const startIndex = skipYamlBlankLines(lines, 0);
    if (startIndex >= lines.length) {
      return null;
    }

    const parsed = parseYamlBlock(lines, startIndex, lines[startIndex].indent);
    if (skipYamlBlankLines(lines, parsed.nextIndex) !== lines.length) {
      throw new Error("yaml_trailing_content");
    }

    return parsed.value;
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
      extensions: ["xml"],
      parse: (text) => extractPreferredXmlText(text),
    },
    {
      extensions: ["yaml", "yml"],
      parse: (text) => {
        try {
          const parsed = parseYamlSubset(text);
          const extracted = extractBestStringFromJson(parsed);
          return extracted || text;
        } catch (_error) {
          // YAML bleibt best-effort: Bei nicht tragfähigem Subset oder erweiterten Features
          // ist Raw-Text sicherer als eine halbkorrekte Struktur, die Nutzdaten verschiebt.
          return text;
        }
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
          // Auch mit erkannter Textspalte droppen wir Zeile 1 nur bei klarer Header-Evidenz,
          // damit headerlose CSVs mit starken Tokens in der ersten Datenzeile nichts verlieren.
          const payloadRows = isLikelyCsvHeaderRow(rows) ? rows.slice(1) : rows;
          return payloadRows
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
