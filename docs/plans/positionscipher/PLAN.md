# Plan: Positionscipher (Block‑Permutation) mit Crack + Tests

**Summary**
Wir fügen einen neuen `Positionscipher` hinzu (Blocklänge = Permutationslänge), integrieren ihn in UI/Run‑Pfad, dokumentieren Scoring + Datenfluss und liefern Regression + 1k‑Gate inklusive Beispiel‑Fixture (`coded_level_17.xml`). Normalisierung ist A–Z mit `X`‑Padding (wie Columnar/Skytale). Keyless‑Crack testet standardmäßig Blocklängen 2–6; längere Längen erfordern einen Hint (begründet durch faktorielles Wachstum der Permutationsanzahl).

**Public API / UI Changes**
- Neuer Cipher in `KryptoCiphers` mit `id: "position-cipher"`, `name: "Positionscipher"`, `supportsKey: true`, `supportsCrackLengthHint: true`.
- UI zeigt neue Cipher‑Option; Key‑Label/Placeholder und Crack‑Längen‑Hint werden gesetzt.
- `app.js` behandelt `position-cipher` wie andere Transpositions‑Ciphers mit Rohtext‑Ausgabe + Segmentierung.

---

## Implementation Changes

### 1) Neuer Cipher: `js/ciphers/positionCipher.js`
**Verhalten**
- **Normalisierung**: A–Z (NFD‑first, AE/OE/UE, ß→SS), nicht‑Buchstaben entfernen.
- **Padding**: auf Vielfaches der Blocklänge mit `X` auffüllen (warum: nur so ist Inversion blockweise deterministisch).
- **Verschlüsselung**: pro Block Ausgabe in der Reihenfolge der Permutation `p`  
  Beispiel `p = [2,5,3,1,4]`: Block `Q U A N T` ⇒ `U T A Q N`.
- **Entschlüsselung**: inverse Permutation `p⁻¹` pro Block anwenden.

**Key‑Parsing**
- Numerische Permutation `1..N` aus beliebigen Separatoren (`2-5-3-1-4`, `2 5 3 1 4`).
- Validierung: Länge ≥ 2, Wertebereich 1..N, keine Duplikate.
- Fehlertexte analog zu Columnar (klar, deutsch).

**Crack‑Pfad (keyless)**
- Standard‑Blocklängen: `2..min(6, text.length)` (Begründung: `7! = 5040` ist ~7× teurer als `6! = 720`, 8! ist zu teuer; Hint deckt >6 ab).
- Mit `options.keyLength`: genau diese Länge (clamped ≥2).
- Permutations‑Cache pro Länge (Map), damit wiederholte Runs nicht neu permutieren.
- Kandidaten‑Scoring:
  - **Fallback‑Score** (schnell) via Bigram/Trigram + Domain‑Wörter (wie Scytale/Columnar).
  - **Shortlist‑Scoring** (präzise) nur für Top‑N (z. B. `ANALYSIS_SHORTLIST_SIZE = 8`) via `dictionaryScorer.analyzeTextQuality`.
  - Confidence‑Formel (analog Scytale):  
    `confidence = qualityScore + coverage*10 + meaningfulTokenRatio*8 - internalXPenalty + domainBonus`
- Kandidatenliste: Top‑8 (Key, text, rawText, confidence).

**Cipher‑Metadaten**
- `keyLabel: "Positions‑Permutation"`, `keyPlaceholder: "z. B. 2-5-3-1-4"`.
- `crackLengthLabel: "Blocklänge"`, `crackLengthPlaceholder: "z. B. 5"`.
- `info`‑Felder (purpose/process/crack/useCase) mit Umlauten.

---

### 2) UI‑Integration
**`index.html`**
- Script‑Tag `js/ciphers/positionCipher.js` vor `js/app.js` einbinden (bei Transpositions‑Ciphers).

**`js/app.js`**
- `rawOnlyCiphers` + `showRawForCipher` um `position-cipher` ergänzen.
- `trimTrailingX` beim Segmentieren aktivieren (wie Columnar/Skytale/Hill).
- Ergebnis: Anzeige segmentiert (`QUANTEN SPRUNG`), Rohtext bleibt sichtbar (`QUANTENSPRUNGXX`).

---

### 3) Tests & Fixtures
**Fixtures**
- `tests/vitest/fixtures/coded_level_17.xml` aus `/home/mrphaot/Downloads/coded_level_17.xml` hinzufügen.

**Regression**
- `tests/vitest/position-regression.test.mjs`
  - `encrypt("QUANTEN SPRUNG", "2-5-3-1-4")` ⇒ `UTAQNNRSEPNXGUX`
  - `decrypt(..., "2-5-3-1-4")` ⇒ `QUANTENSPRUNGXX`
  - `parseKey` gültig/ungültig
  - Fixture‑Test: `parseInputFile(...)` → decrypt + crack (mit `keyLength: 5`) liefert  
    Key `2-5-3-1-4`, `text: "QUANTEN SPRUNG"`, `rawText: "QUANTENSPRUNGXX"`.

**1k‑Gate**
- Generator: `tests/vitest/generators/positionDataset.js`
  - deterministischer RNG wie Columnar
  - Pflichtfälle inkl. QUANTEN‑Beispiel (Key 2‑5‑3‑1‑4)
  - Schlüssel‑Längen 2..6 (damit default‑Crack abgedeckt)
  - eindeutige `(key, plaintext)`‑Paare
- Test: `tests/vitest/position-keyless-e2e-1k.test.mjs`
  - unhinted SuccessRate ≥ 0.99
  - hinted SuccessRate === 1.0
  - Laufzeit < 3 Minuten
  - Vergleich über normalisierte sichtbare Ausgabe (Spaces ignorieren).

---

### 4) Dokumentation
**`docs/SCORING.md`**
- Neuer Abschnitt nach Columnar: „Positionscipher“
- Inhalte: Normalisierung, Padding, Default‑Crack‑Range (2–6), Scoring‑Formel, Shortlist‑Scoring, `rawText`/`displayText`.

**`docs/DATENFLUSS.md`**
- „Rohtext angezeigt“‑Listen um Positionscipher ergänzen (Decrypt + Crack).

**`js/ciphers/AGENTS.md`**
- Neuer Abschnitt: Key‑Format, Normalisierung, Padding, Crack‑Range, Rohtext/Segmentierung.

---

## Checks/Überprüfungen (Sandbox + Plan‑Checks)
1. **Sandbox‑Smoke** (kurz, lokal):  
   - `KryptoCiphers.positionCipher.encrypt("QUANTEN SPRUNG", "2-5-3-1-4")` ⇒ `UTAQNNRSEPNXGUX`  
   - `decrypt(...)` ⇒ `QUANTENSPRUNGXX`
2. **Fixture‑Pfad**: `parseInputFile` auf `coded_level_17.xml`, dann `decrypt` + `crack({ keyLength: 5 })`.
3. **Regressionstest**:  
   - `pnpm run test:vitest -- tests/vitest/position-regression.test.mjs`
4. **1k‑Gate** (lang, ausdrücklich gefordert):  
   - `pnpm run test:vitest -- tests/vitest/position-keyless-e2e-1k.test.mjs`

---

## Abgabekriterien
1. Positionscipher ist in der UI auswählbar und funktional.
2. Beispieldatei (`coded_level_17.xml`) entschlüsselt zu `QUANTEN SPRUNG` (raw `QUANTENSPRUNGXX`), Key `2-5-3-1-4`.
3. Keyless‑Crack ohne Hint findet die Lösung (innerhalb default‑Range), mit Hint stets korrekt.
4. Neue Regression‑Tests + 1k‑Gate grün.
5. `docs/DATENFLUSS.md`, `docs/SCORING.md`, `js/ciphers/AGENTS.md` aktualisiert.
6. Keine neuen Abhängigkeiten, Kommentare erklären das **Warum**.

---

## Assumptions
- A–Z‑Normalisierung mit `X`‑Padding ist gewünscht (bestätigt).
- Keyless‑Crack defaultet auf Blocklängen 2–6; >6 nur mit `keyLength`‑Hint.
- Key‑Format ist numerische Permutation, kein Keyword‑Key.