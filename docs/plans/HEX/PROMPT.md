Du implementierst einen neuen HEX‑Cipher im Repo /home/mrphaot/Dokumente/Kryptografie-Projekt. Dabei folgst du dem Plan unter "docs/plans/HEX/PLAN.md".
Beachte: AGENTS.md, docs/DATENFLUSS.md, docs/SCORING.md, js/ciphers/AGENTS.md. 

Zusammenfassung des Plans:

Anforderungen:
- Neues Modul `js/ciphers/hexCipher.js` (IIFE) mit Export `window.KryptoCiphers.hexCipher`.
- `id: "hex"`, `name: "HEX (UTF-8)"`, `supportsKey: false`, `info`‑Block.
- UTF‑8‑Encode/Decode wie Base64/XOR (TextEncoder/TextDecoder, Buffer‑Fallback, URI‑Fallback).
- HEX‑Utilities mit Lookup‑Tabellen (Byte→HEX, Char→Nibble).
- Input‑Normalisierung: Whitespace entfernen, Mixed‑Case akzeptieren, gerade Länge + nur `0-9A-F`, sonst klarer Error.
- `encrypt`: UTF‑8‑Bytes → uppercase HEX ohne Separatoren.
- `decrypt`: HEX → Bytes → UTF‑8.
- `crack`: deterministisches Decode + `dictionaryScorer.analyzeTextQuality` + Fallback‑Confidence wie Base64; `displayText` nur verwenden, wenn sichtbarer Inhalt erhalten bleibt.
- Script‑Einbindung in `index.html` nach `js/ciphers/xorCipher.js` und vor `js/ciphers/base64Cipher.js`.

Tests:
- Neues Fixture `tests/vitest/fixtures/coded_level_19.txt` mit `494E544552464552454E5A20414D205350414C54`.
- `tests/vitest/hex-regression.test.mjs` (ASCII‑Output, UTF‑8‑Output via Buffer, Whitespace/Mixed‑Case, invalid HEX, Fixture‑Decode, Crack‑Confidence).
- `tests/vitest/generators/hexDataset.js` (deterministisch, Pflichtfälle + 1k eindeutige Fälle).
- `tests/vitest/hex-keyless-e2e-1k.test.mjs` (decrypt+crack success 1.0, <2 min).

Doku‑Sync:
- `AGENTS.md` (kleines Update im Cipher‑Beispiel),
- `docs/DATENFLUSS.md` (HEX im Laufzeitpfad erwähnen),
- `docs/SCORING.md` (HEX‑Abschnitt),
- `js/ciphers/AGENTS.md` (neuer HEX‑Abschnitt).

Zu laufen:
- `node --check js/ciphers/hexCipher.js`
- `pnpm run test:node`
- `pnpm exec vitest run tests/vitest/hex-regression.test.mjs`
- `pnpm exec vitest run tests/vitest/hex-keyless-e2e-1k.test.mjs`

Abgabe: Fixture `coded_level_19.txt` decodiert zu „INTERFERENZ AM SPALT“, 1k‑Gate erfüllt, Doku synchron.