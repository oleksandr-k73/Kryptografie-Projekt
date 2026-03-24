**Title**
HEX‑Codierung (UTF‑8 Bytes → HEX) integrieren

**Summary**
- Neuer keyless Cipher `HEX (UTF-8)` mit robustem HEX‑Parsing, UTF‑8‑Encode/Decode und deterministischem Crack‑Pfad.
- Tests: Regression + 1k‑Gate + Fixture für `coded_level_19.txt`.
- Doku‑Sync in `AGENTS.md`, `docs/DATENFLUSS.md`, `docs/SCORING.md`, `js/ciphers/AGENTS.md`.

**Public Interfaces**
- Neues Cipher‑Export: `window.KryptoCiphers.hexCipher` (`id: "hex"`, `name: "HEX (UTF-8)"`).
- Neue Script‑Einbindung in `index.html`.

**Implementation Changes**
- Neues Modul `js/ciphers/hexCipher.js` im IIFE‑Stil.
- Implementiere `encodeUtf8`/`decodeUtf8` analog zu Base64/XOR (TextEncoder/TextDecoder, Buffer‑Fallback, URI‑Fallback).
- HEX‑Utilities mit Lookup‑Tabellen für Performance: `HEX_TABLE` (Byte → "00"–"FF"), `HEX_LOOKUP` (Char → Nibble).
- `normalizeHexInput(text)` entfernt Whitespace, akzeptiert Mixed‑Case, validiert gerade Länge und nur `0-9A-F`.
- `bytesToHex` nutzt `HEX_TABLE`; `hexToBytes` nutzt `HEX_LOOKUP` und bildet Byte‑Paare.
- `encrypt(text)` = UTF‑8‑Bytes → HEX (uppercase, ohne Separatoren).
- `decrypt(text)` = HEX → Bytes → UTF‑8‑Text; wirft klare Fehler bei ungültigem HEX.
- `crack(text)` dekodiert deterministisch, ermittelt `confidence` via `dictionaryScorer.analyzeTextQuality(...)` (Fallback‑Heuristik wie Base64), übernimmt `displayText` nur wenn der sichtbare Inhalt erhalten bleibt.
- Script‑Einbindung in `index.html` nach `js/ciphers/xorCipher.js` und vor `js/ciphers/base64Cipher.js`.
- Keine Änderungen in `js/app.js` nötig (kein Raw‑Output‑Sonderfall wie XOR).

**Tests**
- Neues Fixture `tests/vitest/fixtures/coded_level_19.txt` mit Inhalt `494E544552464552454E5A20414D205350414C54`.
- `tests/vitest/hex-regression.test.mjs`:
- Prüft ASCII‑Beispiel (fixer Hex‑String) und UTF‑8‑Beispiel (erwarteter HEX via Buffer).
- Prüft Whitespace/Mixed‑Case‑Input beim Decrypt.
- Prüft Fehler bei ungerader Länge und invaliden Zeichen.
- Prüft `parseInputFile` + Decode des `coded_level_19.txt` → `INTERFERENZ AM SPALT`.
- Prüft `crack` liefert `confidence` und sinnvollen Text.
- Generator `tests/vitest/generators/hexDataset.js`:
- deterministischer RNG, Pflichtfälle + 1k eindeutige Fälle, UTF‑8 → HEX, Kommentare mit „Warum?“.
- `tests/vitest/hex-keyless-e2e-1k.test.mjs`:
- deterministische 1000‑Cases, `decrypt` und `crack` jeweils 100% Erfolg, Laufzeit < 2 Minuten.

**Test Plan**
- `node --check js/ciphers/hexCipher.js`
- `node --check tests/vitest/hex-regression.test.mjs`
- `node --check tests/vitest/hex-keyless-e2e-1k.test.mjs`
- `pnpm run test:node`
- `pnpm exec vitest run tests/vitest/hex-regression.test.mjs`
- `pnpm exec vitest run tests/vitest/hex-keyless-e2e-1k.test.mjs`

**Acceptance Criteria**
- `encrypt` erzeugt uppercase HEX ohne Separatoren, 2 Zeichen pro Byte.
- `decrypt` akzeptiert Whitespace/Mixed‑Case, wirft bei ungültiger Länge/Zeichen.
- `crack` dekodiert deterministisch und liefert numerische `confidence`.
- Fixture `coded_level_19.txt` ergibt `INTERFERENZ AM SPALT` (decrypt + crack).
- 1k‑Gate: `decrypt` und `crack` Success‑Rate = 1.0, Laufzeit < 2 Minuten.
- Doku ist synchron: `AGENTS.md`, `docs/DATENFLUSS.md`, `docs/SCORING.md`, `js/ciphers/AGENTS.md`.

**Assumptions**
- Anzeige‑Name: `HEX (UTF-8)`, `id: "hex"`.
- Script‑Reihenfolge: nach XOR, vor Base64.
- Ausgabe immer uppercase, Input toleriert Whitespace und Mixed‑Case.