# Plan: Binärcode (8‑Bit) Cipher + JSON‑Parser Fix

**Summary**
- Neuen keyless Cipher „Binärcode (8‑Bit)“ hinzufügen (UTF‑8‑Bytes ↔ 8‑Bit‑Gruppen mit Leerzeichen).
- JSON‑Parser so anpassen, dass reine 0/1‑Payloads nicht als Hash abgewertet werden (damit `coded` aus Beispieldatei gewinnt).
- Tests + 1k‑Dataset + Doku‑Updates, inklusive Beispieldatei‑Regression.

**Public Interface Changes**
- Neuer Cipher: `id: "binary-8bit"`, `name: "Binärcode (8-Bit)"`, `supportsKey: false`.
- Binär‑Decoding akzeptiert Whitespace‑getrennte Gruppen **oder** reinen 0/1‑String (Länge % 8 == 0).
- JSON‑Heuristik: reine 0/1‑Sequenzen (8‑Bit‑Vielfache) werden **nicht** als Hash bewertet.

**Implementation Changes**
- **Cipher‑Modul (neu)**  
  - Datei `js/ciphers/binaryCipher.js` im IIFE‑Stil anlegen, Export als `window.KryptoCiphers.binaryCipher`.
  - UTF‑8‑Encoding/Decoding analog zu Base64/XOR (TextEncoder/TextDecoder, Buffer‑Fallback).
  - Performance: Vorberechnete `BINARY_TABLE[256]` für Encoding und `BINARY_TO_BYTE`‑Lookup für Decoding.
  - `normalizeBinaryInput(text)`:
    - Whitespace entfernen.
    - Fehler, wenn andere Zeichen als `0/1` vorkommen.
    - Fehler, wenn Länge % 8 != 0.
    - Leerstring erlaubt.
  - `encrypt(text)` → UTF‑8‑Bytes → 8‑Bit‑Strings mit Leerzeichen.
  - `decrypt(text)` → validieren → Bytes → UTF‑8‑Text.
  - `crack(text)` → identisch zu decrypt + Confidence:
    - Fallback‑Scoring ähnlich Base64 (Buchstaben/Leerzeichen/Controls/Replacement).
    - Optional `dictionaryScorer.analyzeTextQuality(...)` nutzen und Confidence überschreiben.
    - Segmentierung nur übernehmen, wenn sichtbarer Text unverändert bleibt.
  - Kommentare mit „Warum?“ (z. B. Lookup‑Tabellen, Validation‑Fehler).

- **JSON‑Parser (robust für Binärcode)**  
  - In `js/core/fileParsers.js` neue Hilfsfunktion `looksLikeBinaryPayload(text)`:
    - nur `0/1`, Länge >= 8, Länge % 8 == 0.
  - `looksLikeHash` so erweitern, dass reine 0/1‑Payloads **kein** Hash sind.
  - Kommentar hinzufügen, warum die Hash‑Heuristik hier bewusst aussetzt (Binary‑Cipher‑Payloads).

- **UI‑Integration**
  - Script‑Einbindung in `index.html` vor `js/app.js`.
  - `info`‑Felder im Cipher füllen (purpose/process/crack/useCase).
  - Optional `keyPlaceholder: "Nicht benötigt"` setzen (UI‑Klarheit).

- **Doku‑Sync**
  - `js/ciphers/AGENTS.md`: Neuer Abschnitt „Binärcode (8‑Bit)“ mit Vertrag + Crack‑Verhalten.
  - `docs/SCORING.md`: neuer Punkt unter „Lokales Sprach‑Scoring“ für Binärcode.
  - `docs/DATENFLUSS.md`: Ergänzung im Parsing‑Abschnitt zur Binary‑Heuristik (Hash‑Penalty‑Ausnahme).

- **Tests & Fixtures**
  - Fixture: `tests/vitest/fixtures/coded_level_20.json` mit Inhalt aus der angehängten Datei.
  - Generator: `tests/vitest/generators/binaryDataset.js` (deterministisch, 1000 einzigartige Klartexte, Pflichtfall `UNSCHAERFE IM ORT`).
  - Regressionstest: `tests/vitest/binary-regression.test.mjs`
    - Encrypt/Decrypt‑Roundtrip (inkl. Umlaut‑Text).
    - Beispielstring exakt (Binary ↔ Text).
    - Invalid‑Input‑Errors (falsche Länge, ungültige Zeichen).
    - `parseInputFile` extrahiert `coded` aus JSON‑Fixture.
    - `crack` liefert `key: null`, `confidence` finite.
  - 1k‑Gate: `tests/vitest/binary-keyless-e2e-1k.test.mjs`
    - `decrypt` und `crack` Success‑Rate 1.0, Laufzeit < 2 Min.

**Test Plan**
1. `pnpm run test:vitest -- tests/vitest/binary-regression.test.mjs`
2. `pnpm run test:node` (Doku‑Contracts nach Updates)
3. `pnpm run test:vitest -- tests/vitest/binary-keyless-e2e-1k.test.mjs`  
   Hinweis: 1k‑Test nur nach expliziter Freigabe ausführen.

**Abgabekriterien**
- Neuer Cipher taucht im UI‑Dropdown auf und ist nutzbar.
- `encrypt`/`decrypt` funktionieren deterministisch, auch mit Umlauten.
- JSON‑Beispiel `coded_level_20.json` decodiert zu `UNSCHAERFE IM ORT`.
- Regressionstest + Doku‑Checks grün.
- 1k‑Gate grün, wenn explizit ausgeführt.
- Doku‑Sync abgeschlossen (AGENTS, DATENFLUSS, SCORING).

**Assumptions**
- UTF‑8‑Bytes sind gewünscht (Umlaute bleiben korrekt).
- Decoding akzeptiert Whitespace‑getrennte Gruppen oder durchgehenden 0/1‑String.
- Binary‑Heuristik im JSON‑Parser ist die minimalinvasive Lösung.
