# Hand‑Off Plan: Columnar‑Transposition Update (vollständig)

## Summary
- Neuer Columnar‑Transposition Cipher mit numerischen **und** Keyword‑Schlüsseln.
- A‑Z‑Normalisierung mit X‑Padding.
- Keyless‑Crack bis Schlüssellänge 6 mit Shortlist‑Scoring.
- UI‑Integration mit Rohtext/Segmentierung wie Skytale.
- Regression‑ und 1k‑E2E‑Tests sowie Doku‑Updates.
- Tests werden **bei der Implementierung** normal ausgeführt.

## Anforderungen Abgedeckt
- Fehlerfreie, optimierte Implementierung passend zur Architektur.
- Keine Konflikte in aktueller und zukünftiger Architektur, inkl. Doku‑Gates.
- Tests inkl. 1k‑Lauf und Beispieltext‑Entschlüsselung aus `coded_level_08.json`.

## Design‑Entscheidungen
- Schlüssel‑Format: numerisch **und** Keyword.
- Text‑Handling: A‑Z‑Normalisierung, Umlaute transliterieren, X‑Padding.
- Crack‑Limit ohne Hint: max. Schlüssellänge 6.

## Implementierungsänderungen

### 1) Neuer Cipher
- Datei: `js/ciphers/columnarTranspositionCipher.js`
- Muster: IIFE, Export über `window.KryptoCiphers`.
- Vertrag: `id`, `name`, `encrypt`, `decrypt`, `crack`, optional `supportsKey`, `parseKey`, `supportsCrackLengthHint`, `info`.

**Cipher‑Meta**
- `id: "columnar-transposition"`
- `name: "Columnar Transposition"`
- `supportsKey: true`
- `supportsCrackLengthHint: true`
- `reuseKeyForCrackHint: false`
- `keyLabel: "Spaltenreihenfolge"`
- `keyPlaceholder: "z. B. 3-1-4-2 oder ZEBRA"`
- `crackLengthLabel: "Spaltenanzahl"`
- `crackLengthPlaceholder: "z. B. 4"`

**Key‑Parsing**
- Numerisch: Tokens aus Ziffern extrahieren (Trenner: Leerzeichen, Komma, Bindestrich). Validierung: Permutation von `1..N`, `N >= 2`.
- Keyword: Normalisieren auf A‑Z. Alphabetisch sortieren; gleiche Buchstaben stabil nach Originalposition. Ergebnis als Permutationsarray `1..N`.
- Fehlertexte mit Umlauten, z. B. „Schlüssel muss eine Permutation von 1..N sein.“

**Normalisierung**
- Umlaute: `Ä->AE`, `Ö->OE`, `Ü->UE`, `ä->AE`, `ö->OE`, `ü->UE`, `ß->SS`.
- Entferne Nicht‑Buchstaben.
- Padding: `X` bis Vielfaches der Spaltenanzahl.

**Encrypt**
- Raster **zeilenweise** füllen.
- Spalten **in Schlüsselreihenfolge** auslesen.
- Ausgabe: A‑Z + X.

**Decrypt**
- Normalisierung + Padding.
- Spalten **in Schlüsselreihenfolge** mit Ciphertext‑Segmenten füllen.
- Zeilenweise auslesen.
- Rückgabe: Rohtext inkl. Padding.

**Crack**
- Wenn `options.keyLength`: nur diese Spaltenanzahl.
- Sonst testet `2..min(6, text.length)`.
- Permutationen streaming‑basiert erzeugen.
- Fallback‑Score für alle Kandidaten.
- Shortlist pro Schlüssellänge (z. B. Top‑6) mit `dictionaryScorer.analyzeTextQuality(...)`.
- Kandidaten absteigend nach `confidence`.
- Rückgabe: `key` als String `"3-1-4-2"`, `text` segmentiert, `rawText` inkl. Padding, `candidates` sortiert (max. z. B. 8).
- Kommentare: Fokus auf „Warum?“.

### 2) UI‑Integration
- `index.html`: Script `js/ciphers/columnarTranspositionCipher.js` vor `js/app.js` einbinden.
- `js/app.js`: Columnar in `rawOnlyCiphers` und `showRawForCipher` aufnehmen. Segmentierung via `segmentRawText` mit `trimTrailingX: true` wie Skytale.

### 3) Dokumentation
- `js/ciphers/AGENTS.md`: Abschnitt „Columnar Transposition“ mit Key‑Formaten, Normalisierung, Crack‑Verhalten, Rohtext/Segmentierung.
- `docs/DATENFLUSS.md`: Decrypt liefert Rohtext, UI segmentiert. Crack nutzt Shared‑Scoring + Kandidatenliste.
- `docs/SCORING.md`: Fallback‑Score + Shortlist‑Rescoring für Columnar.

### 4) Tests & Fixtures
- Fixture:
  - `tests/vitest/fixtures/coded_level_08.json`
  - Inhalt aus `\\gy166583\\olexandr.k\\Download\\coded_level_08.json`
  - Erwartung: `coded` = `TIOOLPNLFEEAPDXOTTML`
- Generator:
  - `tests/vitest/generators/columnarDataset.js`
  - Seeded RNG, Pflichtfälle inkl. `POTENTIALTOPF MODELL` mit Key `3-1-4-2`
  - Zufällige Permutationen mit Längen 2..6
- Regression‑Test:
  - `tests/vitest/columnar-regression.test.mjs`
  - Verify:
    - Plain: `POTENTIALTOPF MODELL`
    - Key: `3-1-4-2`
    - Cipher: `TIOOLPNLFEEAPDXOTTML`
    - Decrypt‑Raw: `POTENTIALTOPFMODELLX`
  - `parseKey` Validierung für numerisch + Keyword.
  - JSON‑Fixture via `parseInputFile`.
  - Crack mit `keyLength: 4` liefert `POTENTIALTOPF MODELL` + `rawText`.
- 1k‑E2E‑Test:
  - `tests/vitest/columnar-keyless-e2e-1k.test.mjs`
  - Deterministische Datensätze, Pflichtfälle, Größe 1000.
  - Gate: `unhinted >= 0.99`, `hinted === 1.0`, Runtime < 3 Minuten.
  - Timeout z. B. `210_000`.

## Test Plan (für Implementierung)
- `pnpm run test:vitest -- tests/vitest/columnar-regression.test.mjs tests/vitest/columnar-keyless-e2e-1k.test.mjs`
- `node --test tests/docs/*.test.mjs`

### Abgabekriterien
1. Cipher ist registriert und erscheint im UI.
2. Beispieltext aus coded_level_08.json wird mit Key 3-1-4-2 korrekt entschlüsselt:
  - text: POTENTIALTOPF MODELL
  - rawText: POTENTIALTOPFMODELLX
3. Key‑Parsing akzeptiert sowohl 3-1-4-2 als auch Keyword (z. B. ZEBRA) und lehnt ungültige Permutationen ab.
4. Keyless‑Crack liefert bei 1k‑Suite die geforderten Erfolgsraten (unhinted ≥ 0.99, hinted = 1.0) innerhalb des Zeitlimits.
5. Doku‑Gates bestehen: AGENTS.md, docs/DATENFLUSS.md, docs/SCORING.md konsistent.
6. Keine Regression: bestehende Ciphers unverändert im Verhalten.

## Risiken & Mitigations
- Permutations‑Explosion: Limit auf Länge 6, Streaming‑Generator + Shortlist‑Rescoring.
- Segmentierung: Nur im Crack‑Pfad; Decrypt bleibt Rohtext.
- Doku‑Gates: Docs konsistent mit Code und Script‑Reihenfolge.


