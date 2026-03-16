# Handoff Prompt (Context‑Engineering, kompakt)
Du arbeitest in `/home/mrphaot/Dokumente/Kryptografie-Projekt`.

Ziel:
- Den Plan unter `docs/plans/skytaleCipher1/PLAN.md` implementieren. Hier sind die wichtigsten Infos zusammengefasst:
    1) Skytale‑Cipher implementieren (A‑Z Normalisierung, Padding `X`, Spalten füllen/Zeilen lesen).
    2) Crack mit Bruteforce + `keyLength`‑Hint, Scoring via `dictionaryScorer.analyzeTextQuality`.
    3) Segmentierung im Core verbessern, **nur** Leerzeichen ändern.
    4) Playfair‑Crack muss Key `FAC` finden.

Beispiel:
- Ciphertext `LTTEARGRSIIXEFTXRFTX`, Umfang `4`.
- decrypt(key=4) → `LASERTRIFFTGITTERXXX`
- crack(keyLength=4) → `LASER TRIFFT GITTER`

Segmentierungs‑Ziele:
- `PHOTOEFFEKTDATEN` → `PHOTOEFFEKT DATEN`
- `MESSREIHEMITFEHLER` → `MESSREIHE MIT FEHLER`
- `UNSCHAERFEIMORT` → `UNSCHAERFE IM ORT`
- `DCODEPLAYFAIRBITTEFUNKTIONIEREICHMUSSWEITER` → `DCODE PLAYFAIR BITTE FUNKTIONIERE ICH MUSS WEITER`

Wichtig:
- Lies VOR DEM BEGINN AGENTS.md und andere Markdowns (außer den erlaubten unter docs/plans und außer REPORT-FINAL.md)
- Doku‑Sync: `js/ciphers/AGENTS.md`, `docs/DATENFLUSS.md`, `docs/SCORING.md`.

Tests:
- `node --test tests/docs/*.test.mjs`
- `./node_modules/.bin/vitest run tests/vitest/*.test.mjs`
- `node scripts/docs/run_quality_gates.mjs --iterations 25`