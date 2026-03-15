# Hand-off: Skytale + Segmentierung (Core) + Tests

## Summary
- Ziel: Skytale‑Cipher mit Umfang‑Hint + Bruteforce sowie robuste Segmentierung (nur Leerzeichen ändern, Wortlaut bleibt), inklusive Regressionen für die genannten Fälle.
- Skytale‑Konvention: A‑Z‑Normalisierung, Padding `X`, **Spalten füllen / Zeilen lesen**.
- Segmentierungs‑Fixes sind core‑weit, dürfen Playfair/Rail‑Fence verbessern, aber keine Wortlautänderung verursachen.

## Key Changes
- **Skytale‑Cipher (neu)**
  - IIFE‑Modul `js/ciphers/scytaleCipher.js` mit Vertrag `encrypt/decrypt/crack`, `supportsKey: true`, `supportsCrackLengthHint: true`.
  - Normalisierung A‑Z wie Playfair, Padding `X` bis Vielfaches des Umfangs.
  - Encrypt: spaltenweise füllen, zeilenweise lesen. Decrypt: zeilenweise füllen, spaltenweise lesen.
  - Crack: ohne Hint Umfang `2..min(12, letters.length)`, mit Hint exakt diese Zahl; Scoring via `dictionaryScorer.analyzeTextQuality`, `rawText` bleibt Padding‑Rohtext.
- **Segmentierung im Core**
  - `SEGMENT_DOMAIN_WORDS` um fehlende Fachwörter erweitern: `photoeffekt`, `messreihe`, `unschaerfe`, `fehler`, `daten`, `laser`, `trifft`, `gitter`, `dcode`, `funktioniere`, `bitte`, `muss`, `weiter`.
  - Short‑Exact‑Wörter erlauben: neues Set z. B. `SHORT_EXACT_SEGMENT_WORDS = ["ich","ort"]`; `classifySegmentUnit(...)` akzeptiert Länge 3 nur aus diesem Set (reduzierter Reward).
  - `refineExactCompoundJoins(...)`: Join‑Schwelle senken, wenn `combinedText.length >= 8` und `combinedToken.kind === "exact"`, damit `PHOTOEFFEKT` nicht auseinanderfällt.
- **Playfair Crack**
  - `PHASE_A_BASE_KEYS` um `FAC` ergänzen (keyless‑Fall muss treffen).
- **UI/Doku‑Sync**
  - `index.html` bindet `js/ciphers/scytaleCipher.js` vor `js/app.js` ein.
  - `js/ciphers/AGENTS.md`, `docs/DATENFLUSS.md`, `docs/SCORING.md` aktualisieren.

## Test Plan
- Neue Scytale‑Tests:
  - 1000‑Datensatz‑Generator `tests/vitest/generators/scytaleDataset.js`.
  - `tests/vitest/scytale-keyless-e2e-1k.test.mjs`:
    - Unhinted successRate ≥ 0.99
    - Hinted successRate == 1.0
    - Runtime < 3 Minuten
  - `tests/vitest/scytale-regression.test.mjs`:
    - Roundtrip mit Padding
    - `coded_level_07.txt`: decrypt(key=4) → `LASERTRIFFTGITTERXXX`, crack(keyLength=4) → `LASER TRIFFT GITTER`
  - Fixture `tests/vitest/fixtures/coded_level_07.txt` mit `LTTEARGRSIIXEFTXRFTX`.
- Segmentierungs‑Regressionen:
  - `PHOTOEFFEKTDATEN` → `PHOTOEFFEKT DATEN`
  - `MESSREIHEMITFEHLER` → `MESSREIHE MIT FEHLER`
  - `UNSCHAERFEIMORT` → `UNSCHAERFE IM ORT`
  - `DCODEPLAYFAIRBITTEFUNKTIONIEREICHMUSSWEITER` → `DCODE PLAYFAIR BITTE FUNKTIONIERE ICH MUSS WEITER`
- Playfair/Rail‑Fence:
  - `playfair.crack("FBPBKLMFVBBGTAOYQIDQPHYOPOKGQGHBGNQTRXGKQISW")` → Key `FAC`, segmentierte Ausgabe.
  - `railFence.crack("UHFONCAREMRSEIT")` → `UNSCHAERFE IM ORT`
  - `railFence.crack("MREFEESEHMTELRSIIH")` → `MESSREIHE MIT FEHLER`
- Gesamtlauf:
  - `node --test tests/docs/*.test.mjs`
  - `./node_modules/.bin/vitest run tests/vitest/*.test.mjs`
  - `node scripts/docs/run_quality_gates.mjs --iterations 25`

## Abgabekriterien
- Alle Tests im Test Plan sind grün.
- Skytale decrypt(key=4) liefert exakt `LASERTRIFFTGITTERXXX`, Crack (keyLength=4) zeigt `LASER TRIFFT GITTER`.
- Segmentierung erzeugt die gewünschten Leerzeichen **ohne** Wortlautänderung.
- Doku‑Sync vollständig (AGENTS + DATENFLUSS + SCORING).

