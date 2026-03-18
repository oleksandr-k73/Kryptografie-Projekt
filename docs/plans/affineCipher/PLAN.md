# Hand‑Off‑Plan: Affine‑Cipher mit editierbarem Alphabet

**Kurzfassung**
- Neuer Cipher `affine` (Key‑Paar `(a,b)`), Modulo = Länge des benutzerdefinierten Alphabets.
- UI‑Feld „Alphabet“ (editierbar, default `ABCDEFGHIJKLMNOPQRSTUVWXYZ`).
- Crack für **jedes** Alphabet erlaubt, aber mit Warnhinweis, da Scoring A–Z‑basiert bleibt.
- Tests: Regression + CSV‑Beispiel + 1k‑Gate mit deterministischem Generator.
- Doku‑Updates in `js/ciphers/AGENTS.md`, `docs/SCORING.md`, `docs/DATENFLUSS.md`.

---

## Implementations‑Details

### 1) Neuer Cipher `js/ciphers/affineCipher.js`
- IIFE‑Pattern wie vorhandene Ciphers.
- Contract:
  - `id: "affine"`, `name: "Affine"`
  - `supportsKey: true`
  - `supportsAlphabet: true`
  - `keyLabel: "Schlüssel (a,b)"`
  - `keyPlaceholder: "z. B. 5,8"`
  - `alphabetLabel: "Alphabet"`
  - `alphabetPlaceholder: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"`
  - `defaultAlphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"`
  - `info: { purpose, process, crack, useCase }`
- **Alphabet‑Normalisierung**
  - Entferne Zeilenumbrüche.
  - Länge ≥ 1.
  - **Eindeutige Zeichen**.
  - **Case‑insensitive uniqueness** für Buchstaben (A/a konflikt).
- **Case‑preserving immer aktiv**
  - Buchstaben werden case‑insensitiv gemappt.
  - Ausgabe übernimmt Case des Eingabe‑Buchstabens.
- **Key‑Parsing**
  - `parseKey(rawKey, { alphabet })`
  - exakt zwei Integer (Regex `/-?\d+/g`)
  - normiere `a,b` modulo `m`
  - validiere `gcd(a,m) === 1`
  - Rückgabe `{ a, b, alphabet, toString() { return `${a},${b}`; } }`
- **Encrypt/Decrypt**
  - `encrypt`: `y = (a*x + b) mod m`
  - `decrypt`: `x = invA * (y - b) mod m`
- **Crack**
  - Alle `a` mit `gcd(a,m)==1`, alle `b` 0..m‑1.
  - Score‑Heuristik **identisch** zu Cäsar.
  - Rückgabe `key`, `text`, `confidence`, `candidates: top8`.

---

## UI‑Änderungen

### `index.html`
- Neues Alphabet‑Feld:
  - `alphabetWrap`, `alphabetInput`, `alphabetHint`
  - Defaultwert im Feld: `ABCDEFGHIJKLMNOPQRSTUVWXYZ`
  - Hinweis: „Alphabet bestimmt Modulo m = Länge.“
- Script‑Include vor `js/app.js`:
  - `<script src="js/ciphers/affineCipher.js"></script>`

### `js/app.js`
- `elements` erweitert um Alphabet‑DOM‑Elemente.
- `refreshAlphabetUI()`:
  - Zeigt Feld nur bei `supportsAlphabet`.
  - Leeres Feld → Default‑Alphabet.
- `runCipher()`:
  - Alphabet nur bei `supportsAlphabet` lesen.
  - `parseKey(rawKey, { alphabet })`.
  - `crackOptions.alphabet = alphabet`.
  - Warnhinweis im Status, wenn Alphabet nicht default:
    - „Hinweis: Benutzerdefiniertes Alphabet – Sprach‑Scoring kann unzuverlässig sein.“

---

## Tests

### Fixture
- `tests/vitest/fixtures/coded_level_10.csv`
```
level,coded
10,"OIRPUSRCWVLWSRGCWZUXWSRZC"
```

### Regression‑Test `tests/vitest/affine-regression.test.mjs`
1. `parseKey("5,8", { alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" })` ok.
2. `parseKey("13,8", { alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" })` → Fehler.
3. Case‑Preserving Roundtrip:
   - `"Abc xyz!"` → encrypt → decrypt → identisch.
4. Beispieltext:
   - `parseInputFile` liest Fixture.
   - `crack` → `WAHRSCHEINLICHKEITSDICHTE`.
5. Custom Alphabet Roundtrip:
   - Alphabet `"ABCDEF123"`
   - Key `(5,2)`, Text `"FACE 123"`
   - Roundtrip identisch.

### 1k‑Gate
- Generator `tests/vitest/generators/affineDataset.js` (seeded).
- Alphabet im Generator **immer Default**.
- Test `tests/vitest/affine-keyless-e2e-1k.test.mjs`:
  - `successRate >= 0.99`
  - `elapsed < 2 min`
  - Normalisierung: `replace(/\s+/g,"").toUpperCase()`.

---

## Doku‑Updates

- `js/ciphers/AGENTS.md`: Abschnitt Affine.
- `docs/SCORING.md`: Scoring + Crack‑Pfad Affine.
- `docs/DATENFLUSS.md`: Alphabet‑Input als optionales Cipher‑Feld.

---

## Abgabekriterien (verbindlich)

1. **Funktional**
   - `encrypt`/`decrypt` sind echte Inversen für Default‑Alphabet.
   - Case‑preserving bleibt erhalten.
   - Beispieltext `OIRPUSRCWVLWSRGCWZUXWSRZC` entschlüsselt zu `WAHRSCHEINLICHKEITSDICHTE`.

2. **Tests**
   - `pnpm run test:vitest -- tests/vitest/affine-regression.test.mjs` **grün**.
   - `pnpm run test:vitest -- tests/vitest/affine-keyless-e2e-1k.test.mjs` **grün**.
   - Keine Regressionen in bestehenden Vitest‑Tests (optional: `pnpm run test:vitest`).

3. **Dokumentation**
   - `js/ciphers/AGENTS.md`, `docs/SCORING.md`, `docs/DATENFLUSS.md` aktualisiert.
   - Dokus und Code konsistent (Docs‑Gates bestehen).

4. **UI**
   - Alphabet‑Feld sichtbar nur für Affine.
   - Default‑Alphabet korrekt vorbefüllt.
   - Warnhinweis bei custom Alphabet.

5. **Qualität**
   - Kommentare mit „Warum“.
   - Keine neuen Dependencies.
   - Keine Git‑Befehle.

---

## Test‑Runs (vom Implementierer)

1. `pnpm run test:vitest -- tests/vitest/affine-regression.test.mjs`
2. `pnpm run test:vitest -- tests/vitest/affine-keyless-e2e-1k.test.mjs`
3. Optional: `pnpm run test:vitest`

---

## Annahmen
- Alphabet darf Länge 1 haben (degenerierter Cipher).
- Leeres Alphabet ist ungültig.
- Crack‑Scoring bleibt A–Z‑basiert → Warnhinweis bei Custom Alphabet.
