# Zahlen‑Cipher (A1Z26 + Cäsar) – Hand‑Off‑Plan

**Summary**
- Neuer Cipher „Zahlen‑Cäsar“: Encrypt nimmt Klartext, verschiebt per Cäsar, kodiert danach strikt A1Z26 mit Strich‑Separatoren; Decrypt nimmt Zahlen, dekodiert A1Z26 und verschiebt zurück.
- Keyless‑Crack testet 26 Shifts, liefert segmentierten Klartext plus Rohtext ohne Leerzeichen (Raw‑Output), Key = Shift.
- UI‑Integration nutzt bestehende Architektur ohne Konflikte; Segmentierung läuft über den zentralen UI‑Pfad.
- Tests: neue Regression + eigener 1000‑Fälle‑Lauf; Beispiel‑CSV (coded_level_16) wird als Fixture validiert.
- Abgabekriterien explizit dokumentiert; bestehende (separat zu fixende) 1k‑Fehler sind **nicht Teil** dieses Plans.

**Key Changes**
1. **Neuer Cipher (A1Z26 + Cäsar)**
- Datei `js/ciphers/numberCaesarCipher.js` (IIFE, Export `window.KryptoCiphers.numberCaesarCipher`).
- `id: "number-caesar"`, `name: "Zahlen‑Cäsar"`, `supportsKey: true`, `keyLabel: "Schlüssel"`, `keyPlaceholder: "z. B. 3"`.
- `parseKey(rawKey)` akzeptiert ganze Zahl, normalisiert mod 26.
- `encrypt(text, key)`:
  - Normalisierung: NFD + Umlaut‑Digraphen (Ä→AE, Ö→OE, Ü→UE, ß→SS), danach nur `A‑Z`.
  - Caesar‑Shift auf A‑Z.
  - A1Z26‑Ausgabe als `"-"`‑getrennte Zahlen (1–26).
- `decrypt(text, key)`:
  - Strict A1Z26‑Parsing (Separatoren `-` + Whitespace, Tokens nur `1..26`, sonst Error).
  - Zahlen→Buchstaben, Caesar‑Shift rückwärts.
  - Rückgabe **ohne** Leerzeichen (A‑Z), damit UI‑Segmentierung konsistent ist.
- `crack(text)`:
  - Zahlen→Buchstaben einmal dekodieren, dann 26 Shifts bewerten (Cäsar‑Scoring wie `caesarCipher`).
  - `rawText` = bestes Shift‑Ergebnis ohne Leerzeichen.
  - `text` = gleiches Ergebnis (UI segmentiert später).
  - `candidates` = Top‑N (z. B. 8) mit `key`, `text`, `confidence`.
- **Kommentare**: in jeder Funktion mindestens ein Warum‑Kommentar (Projektregel).

2. **UI‑Integration & Segmentierung**
- `index.html`: neues Script `<script src="js/ciphers/numberCaesarCipher.js"></script>` **vor** `js/app.js`.
- `js/app.js`:
  - In `rawOnlyCiphers` **und** `showRawForCipher` die ID `"number-caesar"` ergänzen, damit Decrypt/Crack über `segmentRawText(...)` sauber segmentiert und Raw‑Output sichtbar ist.
  - Keine neuen UI‑Felder nötig; Schlüssel nutzt Standard‑Input.

3. **Doku‑Updates**
- `js/ciphers/AGENTS.md`: neuer Abschnitt „Zahlen‑Cäsar“ mit Vertrag, I/O‑Regeln, Crack‑Verhalten.
- `docs/SCORING.md`: unter „Lokales Sprach‑Scoring“ ergänzen, dass der Zahlen‑Cipher die Cäsar‑Heuristik auf dekodierten A‑Z‑Texten nutzt und 26 Shifts testet.
- `docs/DATENFLUSS.md`: erwähnen, dass Zahlen‑Cäsar bei Decrypt/Crack segmentiert angezeigt wird und Raw‑Output liefert.
- Keine Änderungen an doc‑contract headings; Pflicht‑Tokens bleiben erhalten.

4. **Tests & Fixtures**
- Fixture hinzufügen: `tests/vitest/fixtures/coded_level_16.csv` (Inhalt aus `coded_level_16.csv`).
- Regressionstest `tests/vitest/number-caesar-regression.test.mjs`:
  - `parseKey` validiert ganze Zahlen.
  - Encrypt/Decrypt Roundtrip.
  - Fixture‑Test: decrypt mit Key=3 liefert Rohtext `MODELLUNDGRENZEN`, Crack liefert segmentiert `MODELL UND GRENZEN`.
- 1k‑E2E‑Test:
  - Generator `tests/vitest/generators/numberCaesarDataset.js` (SeededRNG, 1000 eindeutige Fälle, eigene Texte).
  - Test `tests/vitest/number-caesar-keyless-e2e-1k.test.mjs`:
    - Determinismus (Seed gleich).
    - Erfolgsrate: unhinted >= 0.99, hinted == 1.0, Laufzeit < 3 Minuten.

**Abgabekriterien**
- Neue Cipher‑Funktionalität erfüllt die bestätigten Optionen (A1Z26 strikt, Encrypt/Decrypt‑Form, Crack‑Output).
- Beispiel‑CSV liefert erwartete Lösung:
  - Roh: `MODELLUNDGRENZEN`
  - Segmentiert: `MODELL UND GRENZEN`
- Neue Tests sind grün:
  - `number-caesar-regression.test.mjs`
  - `number-caesar-keyless-e2e-1k.test.mjs`
- Keine bestehenden Regressionstests werden verschlechtert.
- Doku‑Synchronität (AGENTS + DATENFLUSS + SCORING) ist gewährleistet.

**Test Plan**
1. Schnellchecks (Sandbox):
- Cipher‑Isolation via Node‑VM (nach Skill `skills/cipher-new-method`).
2. Relevante Tests:
- `pnpm run test:vitest -- tests/vitest/number-caesar-regression.test.mjs`
- `pnpm run test:vitest -- tests/vitest/number-caesar-keyless-e2e-1k.test.mjs`
3. Optional (wenn du es explizit willst):
- `pnpm run test:node` (Doku‑Gates)
- Keine weiteren 1k‑Suites ohne Auftrag.

**Assumptions**
- Die aktuell roten, separaten 1k‑Suites sind **out of scope** und werden unabhängig gefixt.
- ID/Name: `id="number-caesar"`, `name="Zahlen‑Cäsar"`.
- A1Z26 strikt (1–26), Separatoren `-` + Whitespace, sonst Fehler.
- Crack liefert segmentierten Text über UI‑Pfad; Raw‑Output zeigt den kompakten Rohtext.