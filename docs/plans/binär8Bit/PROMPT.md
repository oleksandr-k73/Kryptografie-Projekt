Du implementierst in /home/mrphaot/Dokumente/Kryptografie-Projekt den neuen Cipher „Binärcode (8-Bit)“ inkl. Parser-Fix + Tests + Doku. 
Dabei musst du dem Plan unter "docs/plans/binär8Bit/PLAN.md" folgen.

Zusammenfassung des Plans:

Constraints: Keine Git-Befehle. Keine großen Abhängigkeiten. Kommentare sind Pflicht und sollen das „Warum“ erklären. Script-Reihenfolge in index.html beibehalten. 
Entscheidungen: 
- UTF‑8‑Bytes kodieren/decodieren. 
- Decoding erlaubt Whitespace oder durchgehenden 0/1‑String (Länge % 8 == 0). 
- JSON‑Parser: reine 0/1‑Sequenzen (8‑Bit‑Vielfache) werden nicht als Hash gewertet, damit `coded` gewinnt.

Implementierung:
- Neues Modul `js/ciphers/binaryCipher.js` (IIFE, `window.KryptoCiphers.binaryCipher`, `id: "binary-8bit"`, `name: "Binärcode (8-Bit)"`, `supportsKey: false`, `info`-Felder ausfüllen, optional `keyPlaceholder: "Nicht benötigt"`). 
- Encoding: UTF‑8‑Bytes → 8‑Bit‑Gruppen mit Leerzeichen (Lookup‑Tabellen für Speed). 
- Decoding: Validation (nur 0/1, Länge % 8), Bytes rekonstruieren, UTF‑8‑Decode. 
- `crack` = deterministisches Decode + Confidence via dictionaryScorer (Fallback wie Base64; Segmentierung nur übernehmen, wenn sichtbarer Text gleich bleibt).

Parser‑Fix:
- In `js/core/fileParsers.js` `looksLikeBinaryPayload` hinzufügen (nur 0/1, Länge >= 8, Länge % 8 == 0).
- `looksLikeHash` so anpassen, dass Binary‑Payloads nicht als Hash gelten. Kommentar mit „Warum“.

Doku:
- `js/ciphers/AGENTS.md`, `docs/SCORING.md`, `docs/DATENFLUSS.md` erweitern.

Tests:
- Fixture `tests/vitest/fixtures/coded_level_20.json` mit Beispielinhalt.
- Generator `tests/vitest/generators/binaryDataset.js` (1000 einzigartige Klartexte, Pflichtfall `UNSCHAERFE IM ORT`).
- `tests/vitest/binary-regression.test.mjs` mit Roundtrip/Invalid/Fixture/Crack.
- `tests/vitest/binary-keyless-e2e-1k.test.mjs` mit 1k‑Gate (nur nach Freigabe laufen lassen).

Testlauf (falls freigegeben):
- `pnpm run test:vitest -- tests/vitest/binary-regression.test.mjs`
- `pnpm run test:node`
- `pnpm run test:vitest -- tests/vitest/binary-keyless-e2e-1k.test.mjs` (lang, nur nach Freigabe).