# Hand-Off Plan v2: Playfair (didaktisch) + XML + validierter Hybrid-Crack

## Implementation Changes
1. Neuer Cipher in [js/ciphers/playfairCipher.js](/home/mrphaot/Dokumente/Kryptografie-Projekt/js/ciphers/playfairCipher.js) mit vollständigem Vertrag (`id`, `name`, `encrypt`, `decrypt`, `crack`, `parseKey`, `supportsKey`, `info`).
2. Didaktische Playfair-Regeln fixieren:
3. `J -> I`, nur `A-Z`, Bigramme, `X` bei Doppelzeichen, `X`-Padding bei ungerader Länge.
4. Entschlüsselungs-Postprocessing fixieren:
5. `removeDidacticPadding` (inneres `X` bei `A X A` entfernen, trailing `X` entfernen).
6. Lesbare Ausgabe per Segmentierung gegen lokales Lexikon (Wortgrenzen).
7. Hybrid-Crack fixieren:
8. Phase A: Key-Shortlist (deterministisch, inkl. `QUANT`).
9. Phase B: erweitertes Key-Corpus aus Wörterbuch-/Lexikonbegriffen + Präfix-/Stems.
10. Ambiguitäts-Gate für Fallback aktivieren, wenn mindestens eine Bedingung erfüllt ist:
11. `top1.confidence < minConfidence`
12. `top1.confidence - top2.confidence < minDelta`
13. `coverage(top1) < minCoverage`
14. XML-Parser in [js/core/fileParsers.js](/home/mrphaot/Dokumente/Kryptografie-Projekt/js/core/fileParsers.js):
15. Neue `xml`-Rule mit striktem Tag-Matching `<coded ...>...</coded>` etc.
16. Priorisierte Tags: `coded`, `ciphertext`, `cipher`, `text`, `message`, `payload`, `content`, `data`, `body`.
17. Fallback: Strip von XML-Tags und Whitespace-Normalisierung.
18. UI/Bootstrapping:
19. [index.html](/home/mrphaot/Dokumente/Kryptografie-Projekt/index.html): `.xml`, `application/xml`, `text/xml` in `accept`; Script-Einbindung für Playfair vor `js/app.js`; Hinweistext aktualisieren.
20. [js/app.js](/home/mrphaot/Dokumente/Kryptografie-Projekt/js/app.js): bei Playfair ohne manuellem Schlüssel optionale Key-Kandidaten aus `dictionaryScorer` ziehen und an `crack` geben.
21. Doku syncen: [AGENTS.md](/home/mrphaot/Dokumente/Kryptografie-Projekt/AGENTS.md), [docs/DATENFLUSS.md](/home/mrphaot/Dokumente/Kryptografie-Projekt/docs/DATENFLUSS.md), [docs/SCORING.md](/home/mrphaot/Dokumente/Kryptografie-Projekt/docs/SCORING.md), [js/ciphers/AGENTS.md](/home/mrphaot/Dokumente/Kryptografie-Projekt/js/ciphers/AGENTS.md).

## Public Interfaces
1. `window.KryptoCiphers.playfairCipher` (neu).
2. `parseInputFile(file)` unterstützt `xml` als normales Format (`fallback: false` bei erfolgreicher Extraktion).
3. `window.KryptoCore.dictionaryScorer.getKeyCandidates(options)` (neu, optional): liefert Schlüsselvorschläge für Crack-Phase B.

## Referenzcode (im Trockenlauf erfolgreich)
```js
// --- Kernregeln: Playfair didaktisch ---
function normalizeBase(input) {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "SS")
    .toUpperCase();
}

function toPlayfairAZ(text) {
  return normalizeBase(text).replace(/[^A-Z]/g, "").replace(/J/g, "I");
}

const ALPHABET_25 = "ABCDEFGHIKLMNOPQRSTUVWXYZ";

function squareFromKey(key) {
  const normalizedKey = toPlayfairAZ(key);
  let used = "";
  for (const ch of normalizedKey + ALPHABET_25) {
    if (!used.includes(ch)) used += ch;
  }
  return used;
}

function squarePos(square) {
  const pos = new Map();
  for (let i = 0; i < 25; i += 1) {
    pos.set(square[i], [Math.floor(i / 5), i % 5]);
  }
  return pos;
}

function makeDigraphs(plainText) {
  const clean = toPlayfairAZ(plainText);
  const pairs = [];
  for (let i = 0; i < clean.length; i += 1) {
    const a = clean[i];
    let b = clean[i + 1] || "X";
    if (a === b) {
      b = "X";
    } else {
      i += 1;
    }
    pairs.push([a, b]);
  }
  return pairs;
}

function encryptPlayfair(plainText, key) {
  const square = squareFromKey(key);
  const pos = squarePos(square);
  let out = "";
  for (const [a, b] of makeDigraphs(plainText)) {
    const [ra, ca] = pos.get(a);
    const [rb, cb] = pos.get(b);
    if (ra === rb) out += square[ra * 5 + ((ca + 1) % 5)] + square[rb * 5 + ((cb + 1) % 5)];
    else if (ca === cb) out += square[((ra + 1) % 5) * 5 + ca] + square[((rb + 1) % 5) * 5 + cb];
    else out += square[ra * 5 + cb] + square[rb * 5 + ca];
  }
  return out;
}

function decryptPlayfair(cipherText, key) {
  const square = squareFromKey(key);
  const pos = squarePos(square);
  const text = toPlayfairAZ(cipherText);
  let out = "";
  for (let i = 0; i < text.length; i += 2) {
    const a = text[i];
    const b = text[i + 1] || "X";
    const [ra, ca] = pos.get(a);
    const [rb, cb] = pos.get(b);
    if (ra === rb) out += square[ra * 5 + ((ca + 4) % 5)] + square[rb * 5 + ((cb + 4) % 5)];
    else if (ca === cb) out += square[((ra + 4) % 5) * 5 + ca] + square[((rb + 4) % 5) * 5 + cb];
    else out += square[ra * 5 + cb] + square[rb * 5 + ca];
  }
  return out;
}

function removeDidacticPadding(text) {
  const chars = toPlayfairAZ(text).split("");
  const out = [];
  for (let i = 0; i < chars.length; i += 1) {
    const prev = out[out.length - 1] || null;
    const cur = chars[i];
    const next = chars[i + 1] || null;
    if (cur === "X" && prev && next && prev === next) continue;
    out.push(cur);
  }
  if (out[out.length - 1] === "X") out.pop();
  return out.join("");
}

// --- XML strict extraction ---
function extractXmlPreferredText(xmlText) {
  const src = String(xmlText || "");
  const tags = ["coded", "ciphertext", "cipher", "text", "message", "payload", "content", "data", "body"];
  for (const tag of tags) {
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
    const m = src.match(re);
    if (m && m[1] && m[1].trim()) return m[1].trim();
  }
  return src.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
```

```js
// --- Hybrid crack with ambiguity gate (validated logic) ---
function shouldTriggerFallback(top1, top2, metrics, cfg) {
  if (!top1) return true;
  if (top1.confidence < cfg.minConfidence) return true;
  if ((top1.confidence - (top2 ? top2.confidence : -Infinity)) < cfg.minDelta) return true;
  if (metrics.coverage < cfg.minCoverage) return true;
  return false;
}

// cfg defaults used in dry run
const CRACK_CFG = {
  minConfidence: 11.2,
  minDelta: 1.8,
  minCoverage: 0.62,
};

// Phase A: shortlist (includes QUANT)
// Phase B: expanded key corpus (dictionary words + stems/prefixes)
// fallback rate target in tests: >= 0.80
```

## Test Plan
1. Neue Tests: `tests/vitest/playfair-regression.test.mjs`.
2. `decrypt(encrypt(text,key),key)` Roundtrip.
3. Pflichtfalltest: `YBSMHOPNKELNFNDKHFKCAY` -> sinnvoll `VERSCHRAENKTE TEILCHEN`.
4. Keyless Crack: deterministisch, Kandidaten sortiert, `search`-Metadaten konsistent.
5. Ambiguitäts-Gate-Test: konstruiertes Kurztext-Beispiel triggert Fallback (bei geringem Delta/Coverage).
6. Fallback-Erfolgsrate-Test auf deterministic fixture (`>= 0.80`).
7. XML-Tests ergänzen in `feature-proposals-regression` oder neue Datei:
8. `codedExport` mit `<coded>` extrahiert korrekt.
9. Strict matching verhindert Fehlgriff auf `<codedExport>` als `<coded>`.
10. Fallback-Strip funktioniert bei XML ohne priorisierte Tags.
11. Finale Gates:
12. `node --test tests/docs/*.test.mjs`
13. `./node_modules/.bin/vitest run tests/vitest/*.test.mjs`
14. `node scripts/docs/run_quality_gates.mjs --iterations 25`

## Assumptions
1. Didaktische Playfair-Version bleibt bewusst nicht-historisch-vollständig.
2. Keine neuen externen Abhängigkeiten.
3. Dictionary-API ist optional; lokaler Pfad bleibt deterministisch und vollständig nutzbar.
4. Kommentare werden gemäß Projektregel als “Warum”-Kommentare geschrieben.

