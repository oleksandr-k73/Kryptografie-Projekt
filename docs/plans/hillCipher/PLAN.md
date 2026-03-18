# Hand‑Off‑Plan: Hill‑Cipher mit dynamischer Matrix‑Key‑UI

**Summary**
- Neuer Cipher `hill` mit Schlüsselmatrix (n×n), A‑Z‑Normalisierung, Padding mit `X`, und Entschlüsselung über modulare Matrix‑Inversion.
- UI ergänzt um dynamisches Matrixfeld (Standard 2×2) + Größenfeld `n`; Key‑Input wird für Hill ausgeblendet.
- Keyless‑Crack nur für 2×2 (mathematisch sinnvoll), Bruteforce über alle invertierbaren Matrizen mod 26, mit Sprach‑Scoring (Dictionary‑Scorer) und Fallback‑Heuristik.
- Beispiel verifiziert: `FKBNDADVPRTV` mit `[[3,3],[2,5]]` entschlüsselt roh zu `LICHTIMPULSX` und segmentiert zu `LICHT IMPULS` (nach Trim der Padding‑`X`).
- Tests werden im Implementierungs‑Step ausgeführt (siehe Test Plan).

**Public API / UI‑Interface Changes**
1. Neuer Cipher `hill` in `js/ciphers/hillCipher.js` mit `supportsMatrixKey: true`, UI‑Meta für Matrix‑Input, und `info`‑Block.
2. Neue UI‑Elemente in `index.html`: `keyInputWrap` (Wrapper zum Ausblenden), `matrixKeyWrap`, `matrixSizeInput`, `matrixGrid`, `matrixHint`.
3. `js/app.js` erweitert um Matrix‑Key‑Parsing, Matrix‑UI‑Rendering und Crack‑Option `matrixSize`.
4. `styles.css` bekommt neue Matrix‑Layout‑Klassen für ein bedienbares Grid.

**Implementation Changes**
1. `js/ciphers/hillCipher.js`
- Implementiere `normalizeBase` (Umlaute -> AE/OE/UE, ß -> SS, NFD‑Strip), `toHillAZ`, `padToMultiple`, `chunk`, `mod`, `gcd`, `modInverse`, `matrixMultiplyVector`.
- `parseKey(rawKey)` akzeptiert ein Matrix‑Objekt `{ matrix, size }` (aus der UI) oder 2D‑Arrays; validiert Quadratik, numerische Werte, normalisiert modulo 26, und prüft Invertierbarkeit (Gauss‑Jordan mit invertierbaren Pivots).  
- `encrypt(text, key)` normalisiert, padde auf Blockgröße `n`, multipliziert pro Block (A=0..25), gibt A‑Z‑Ciphertext zurück.
- `decrypt(text, key)` normalisiert, padde bei Bedarf, invertiert Matrix einmal, multipliziert pro Block, gibt Rohtext (inkl. Padding‑`X`) zurück.
- `crack(text, options)`:
  - `n = options.matrixSize || 2`; wenn `n !== 2`, klarer Fehler („Bruteforce nur für 2×2“).
  - Maximaler Zahlenbereich für Bruteforce: `0..25` (mod 26). Das ist der logisch korrekte Oberwert, weil Werte außerhalb mod 26 äquivalent sind.
  - Iteriere alle 2×2‑Matrizen, filtere `gcd(det,26)===1`, nutze direkte 2×2‑Inverse (schneller als Gauss‑Jordan).
  - Scoring: wenn `dictionaryScorer.analyzeTextQuality` verfügbar, nutze `qualityScore`, `coverage`, `meaningfulTokenRatio` und Domain‑Bonus; sonst Bigram/Trigram‑Fallback.  
  - Rückgabe enthält `text`, `rawText`, `confidence`, `key` als String `[[a,b],[c,d]]`, plus Top‑Kandidatenliste (z. B. 8).

2. `index.html`
- Key‑Input in `<div id="keyInputWrap">…</div>` kapseln.
- Neues Matrix‑UI‑Block im `.grid` hinzufügen:
  - `matrixSizeInput` (number, min 2, step 1, default 2).
  - `matrixGrid` für n×n‑Inputs.
  - `matrixHint` mit Hinweis auf modulo 26, Crack‑Limit 2×2.
- Script‑Reihenfolge: `js/ciphers/hillCipher.js` vor `js/app.js`.

3. `styles.css`
- `.matrix-key` Container für Grid+Size.
- `.matrix-grid` als CSS‑Grid mit `grid-template-columns: repeat(n, minmax(42px, 1fr))`.
- `.matrix-cell` Inputs kompakt und zentriert; Größe so, dass 3‑stellige Werte passen.

4. `js/app.js`
- Neue DOM‑Refs: `keyInputWrap`, `matrixKeyWrap`, `matrixSizeInput`, `matrixGrid`, `matrixHint`.
- `refreshKeyUI()`:
  - Bei Hill: `keyInputWrap.hidden = true`, `matrixKeyWrap.hidden = false`.
  - Hinweistext im Decrypt: „Matrix leer lassen, um 2×2 zu knacken.“
- `renderMatrixGrid(size)`:
  - Erstellt n×n Inputs, speichert vorhandene Werte beim Resize.
  - Nutzt `data-row`, `data-col`, damit Key‑Parsing stabil bleibt.
- `readMatrixKey()`:
  - Wenn alle Zellen leer: `null`.
  - Wenn teilweise gefüllt: Fehler („Matrix unvollständig“).
  - Sonst `matrix` als 2D‑Array aus integers.
- `parseOptionalKey()`:
  - Wenn `supportsMatrixKey`: nutze `readMatrixKey()` statt `keyInput`.
- `parseCrackOptions()`:
  - Wenn `supportsMatrixKey`: setze `options.matrixSize = parsedSize`.
- `refreshCrackLengthUI()`:
  - Für Matrix‑Cipher immer hidden, damit kein zweites Hint‑Feld erscheint.
- In `runCipher()`:
  - Hill in `rawOnlyCiphers` und `showRawForCipher` aufnehmen.
  - `trimTrailingX: true` für Hill, damit Segmentierung das Padding entfernt.

**Test Plan**
1. Neue Fixtures
- `tests/vitest/fixtures/coded_level_11.xml` mit `<codedExport><level>11</level><coded>FKBNDADVPRTV</coded></codedExport>`.

2. Regression‑Tests
- `tests/vitest/hill-regression.test.mjs`
  - `parseKey` akzeptiert 2×2 und 3×3, reject non‑square / nicht invertierbar.
  - Beispiel: parseInputFile liest XML, `decrypt(..., [[3,3],[2,5]]) === "LICHTIMPULSX"`.
  - Segmentierung: `dictionaryScorer.analyzeTextQuality("LICHTIMPULS").displayText === "LICHT IMPULS"`.
  - Roundtrip: `decrypt(encrypt(text, key), key)` ergibt normalisierte/padded A‑Z‑Form.
  - Kurzer Crack‑Case 2×2 (sehr kleiner Text).

3. 1k‑Roundtrip‑Gate
- `tests/vitest/generators/hillDataset.js` (Seeded RNG)
  - Erzeugt 1000 eindeutige Fälle mit n aus {2,3,4}.
  - Matrix invertierbar mod 26 via Gauss‑Jordan‑Check.
- `tests/vitest/hill-keyed-e2e-1k.test.mjs`
  - Determinismus (Seed 42).
  - Gate: `decrypt(encrypt(plaintext,key), key)` == normalisierte+padded Form.
  - Laufzeit‑Gate: < 2 Minuten (realistisch).

4. Tests ausführen (bei Implementierung)
- `pnpm run test:vitest -- tests/vitest/hill-regression.test.mjs`
- `pnpm run test:vitest -- tests/vitest/hill-keyed-e2e-1k.test.mjs`
- Optional: `pnpm run test:vitest` nach Doku‑Updates.

**Abgabekriterien**
1. Funktional
- Hill encrypt/decrypt korrekt invertierbar für n×n mit invertierbarer Matrix.
- Beispiel: `FKBNDADVPRTV` + `[[3,3],[2,5]]` -> roh `LICHTIMPULSX`, segmentiert `LICHT IMPULS`.
2. UI
- Matrixfeld sichtbar nur für Hill; Key‑Input sonst wie bisher.
- `n`‑Änderung rendert dynamisch n×n‑Felder.
3. Crack
- Keyless‑Crack nur 2×2, mit sauberem Fehler für n≠2.
- Bruteforce testet Zahlenbereich 0..25 (mod 26).
4. Tests
- Alle Hill‑Tests grün (Regression + 1k Gate).
5. Doku
- `js/ciphers/AGENTS.md`, `docs/SCORING.md`, `docs/DATENFLUSS.md` synchronisiert.
6. Qualität
- Kommentare im Code erklären das „Warum“.
- Keine neuen Dependencies, keine Git‑Befehle.

**Assumptions**
- Hill arbeitet modulo 26 mit A‑Z; Umlaute werden als Digraphen normalisiert.
- Padding mit `X` ist akzeptiert; Segmentierung entfernt `X` am Ende für die Anzeige.
- Bruteforce‑Maximalwert für Matrixeinträge ist 25, da mod 26 äquivalent.
- Keyless‑Crack für n>2 ist aus Performancegründen ausgeschlossen.

