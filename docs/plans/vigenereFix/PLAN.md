## Planabschluss: Vigenère-Fix unter ursprünglichen Voraussetzungen

### Kurzfazit (Verifikation heute)
1. Der gemeldete Fix ist funktional weitgehend da: neue Vigenère-Tests sind grün.
2. Die Gesamtsuite ist nicht vollständig grün: `docs-gates` fällt aktuell wegen `AGENTS.md`-Formatregel.
3. Die Aussage „10k < 2,5h“ ist noch nicht belastbar:
   - Artefakt: 2,09h (Extrapolation aus n=100).
   - Unabhängige Stichprobe heute: 4,521h Projektion (offline, bekannte Schlüssellänge).
4. Damit sind die ursprünglichen Abschlussbedingungen noch **nicht** erfüllt (insb. konsistente 10k-Absicherung).

### Zielzustand (harte Abnahmekriterien)
1. 10k-Lauf mit bekannter Schlüssellänge, gemischten kurzen/langen Texten und Schlüsselrelationen (`key < text`, `key ~ text`, `key = text`) vollständig durchlaufen.
2. Erfolgsquote und Laufzeit im Abschlussreport dokumentiert, inklusive Bucket-Quoten.
3. Laufzeit ≤ 2,5h für den definierten 10k-Datensatz.
4. Alle Tests/Gates grün.

### Öffentliche Interfaces / Vertragsänderungen (zu stabilisieren)
1. `vigenereCipher.crack(text, options)`:
   - `options.candidateBudget`, `options.stateBudget`, `options.evaluationBudget` bleiben unterstützt.
   - `result.search` bleibt Teil der Rückgabe und wird als Debug/Telemetry-Vertrag dokumentiert.
2. `dictionaryScorer.rankCandidates(candidates, { languageHints })`:
   - sprachspezifisches Offline-Scoring und Komposit-Segmentierung bleiben verpflichtend.
3. `app.js`:
   - dynamische `languageHints`-Ableitung bleibt Standardpfad.

### Umsetzungsplan (entscheidungsfertig)
1. **Gate-Fix zuerst**
   - `AGENTS.md` auf exakte Contract-Regel für „Schlecht/Besser“-Paare korrigieren, damit `docs-gates` wieder grün werden.
2. **10k-Referenzdatensatz deterministisch festlegen**
   - Feste Seed-basierte Generierung in einem Runner unter `tests/vitest/` (ohne neue Dependencies).
   - Feste Bucket-Quoten:
     - 30% kurz, 40% mittel, 30% lang.
     - Schlüsselrelationen je Bucket: 50% `key < text`, 30% `key > text/2`, 20% `key = text` (bei kurzen Texten).
3. **Korrektheitssicherung vor Performance**
   - Pflichtfälle aus dem Ursprungsproblem als harte Regression:
     - `Zfcurbctpdqrau` + `keyLength=5` ⇒ `BRICK` / `Youshallntpass`.
     - Komposit vs. segmentiert.
     - Spracheffekt (`en` vs `de`).
     - `APCZX XTPMPH` + `keyLength=5`.
4. **Performance-Reduktion für Kurztextpfad**
   - Kurztext-Rettungsmodus budget-adaptiv machen (nicht pauschal hoch).
   - `stateBudget`/`evaluationBudget` streng an Textlänge und Kandidatenqualität koppeln.
   - Frühabbruch bei stabiler Top-Kandidatenkonvergenz einführen (deterministisch).
5. **Messpipeline in Stufen**
   - Stage A: n=100 (sanity), Stage B: n=1.000, Stage C: n=5.000, Stage D: n=10.000.
   - Jede Stage schreibt JSON+MD in `tests/vitest/fixtures/` mit:
     - `avgMs`, `p50`, `p95`, `totalHours`, `successRate`, Bucket-Quoten.
6. **Finale 10k-Abnahme**
   - Abschluss nur bei `totalHours <= 2.5` und definierter Mindest-Erfolgsquote (empfohlen: ≥ 90% gesamt, ≥ 85% je Bucket).
   - Danach Doku-Sync in:
     - [/home/mrphaot/Dokumente/Kryptografie-Projekt/docs/SCORING.md](/home/mrphaot/Dokumente/Kryptografie-Projekt/docs/SCORING.md)
     - [/home/mrphaot/Dokumente/Kryptografie-Projekt/docs/DATENFLUSS.md](/home/mrphaot/Dokumente/Kryptografie-Projekt/docs/DATENFLUSS.md)
     - [/home/mrphaot/Dokumente/Kryptografie-Projekt/js/ciphers/AGENTS.md](/home/mrphaot/Dokumente/Kryptografie-Projekt/js/ciphers/AGENTS.md)

### Testfälle und Szenarien (Mindestumfang)
1. Regression: BRICK/Youshallntpass.
2. Komposit-Tokenisierung: `Youshallntpass` vs `You shallnt pass`.
3. Sprachpriorität: identischer Kandidatensatz mit `languageHints=["en"]` vs `["de"]`.
4. Budgetfälle: `1M`, `10M`, `n^L`.
5. Kurztext/Langschlüssel: `APCZX XTPMPH`, `keyLength=5`.
6. Eigene Edge-Cases:
   - nur Buchstaben ohne Leerzeichen,
   - gemischte DE/EN-Texte,
   - `key = text length`,
   - sehr kurze Texte mit Mehrdeutigkeit (Determinismus statt zwingend eindeutiger Rekonstruktion).

### Annahmen und Defaults
1. Offline-Modus bleibt primärer Referenzmodus für reproduzierbare Benchmarks.
2. Keine neuen Libraries ohne Freigabe.
3. 10k-Lauf wird auf derselben Maschinenklasse wie die Stichprobe ausgeführt.
4. Wenn 2,5h in Stage C (5k) klar verfehlt wird, erfolgt zuerst Performance-Iteration, dann erneut Stage A–D.
