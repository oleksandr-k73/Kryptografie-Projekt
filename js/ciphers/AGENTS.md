# AGENTS.md fÃ¼r `js/ciphers/`

## Zweck

Diese Datei beschreibt den Vertrag und die Besonderheiten der vorhandenen Cipher-Implementierungen.

## Gemeinsamer Cipher-Vertrag

Jeder Cipher erfÃ¼llt mindestens:
- `id: string`
- `name: string`
- `encrypt(text, key?)`
- `decrypt(text, key?)`
- `crack(text, options?)`

Optionale Metadaten:
- `supportsKey`
- `parseKey(rawKey)`
- `supportsCrackLengthHint`
- `crackLengthLabel`, `crackLengthPlaceholder`
- `info` (purpose/process/crack/useCase)

## CÃ¤sar (`js/ciphers/caesarCipher.js`)

- SchlÃ¼sselbasiert (`supportsKey: true`), SchlÃ¼ssel als ganze Zahl.
- Ver-/EntschlÃ¼sselung per Verschiebung modulo 26.
- `crack(...)` testet alle 26 SchlÃ¼ssel.
- Liefert bestes Ergebnis plus `candidates` (Top-Auswahl).

## Leetspeak (`js/ciphers/leetCipher.js`)

- Kein SchlÃ¼ssel (`supportsKey: false`).
- VerschlÃ¼sselung per fester Substitutionstabelle.
- EntschlÃ¼sselung delegiert auf Crack-Logik.
- Crack nutzt Beam-Search + Sprachbewertung.
- Liefert primÃ¤r den besten Kandidaten (ohne Kandidatenliste).

## Rail Fence (`js/ciphers/railFenceCipher.js`)

- SchlÃ¼sselbasiert (`supportsKey: true`), SchlÃ¼ssel ist die Schienenanzahl als ganze Zahl `>= 2`.
- UnterstÃ¼tzt Schienen-Hint fÃ¼rs Knacken (`supportsCrackLengthHint: true`).
- Im UI wird dasselbe Schienen-Feld fÃ¼r EntschlÃ¼sselung oder Keyless-Crack verwendet.
- Ver-/EntschlÃ¼sselung laufen Ã¼ber den kompletten Zeichenstrom inklusive Leerzeichen und Satzzeichen.
- `decrypt(...)` liefert Rohtext; lesbare Segmentierung bleibt dem Crack-Pfad vorbehalten.
- `crack(...)` testet ohne Hint exakt `2..min(12, text.length - 1)`.
- Der generische `options.keyLength`-Hint wird als Schienenanzahl verwendet.
- Mit `dictionaryScorer.analyzeTextQuality(...)` kann der Crack-Pfad lesbare Segmentierung (`displayText`) in `text` ausgeben und `rawText` separat behalten.
- Tie-Breaker bei gleichem Score: kleinere Rail-Anzahl zuerst.

## Skytale (`js/ciphers/scytaleCipher.js`)

- SchlÃ¼sselbasiert (`supportsKey: true`), SchlÃ¼ssel ist der Umfang (Spaltenanzahl) als ganze Zahl `>= 2`.
- UnterstÃ¼tzt Umfang-Hint fÃ¼rs Knacken (`supportsCrackLengthHint: true`).
- Im UI wird dasselbe Umfang-Feld fÃ¼r EntschlÃ¼sselung oder Keyless-Crack verwendet (`reuseKeyForCrackHint: true`).
- Normalisierung auf `A-Z` (inkl. Umlaut-Transliteration), Padding mit `X` bis Vielfaches des Umfangs.
- VerschlÃ¼sselung: Spalten fÃ¼llen, Zeilen lesen. EntschlÃ¼sselung: Zeilen fÃ¼llen, Spalten lesen.
- `decrypt(...)` liefert Rohtext inklusive Padding; Segmentierung bleibt dem Crack-Pfad vorbehalten.
- `crack(...)` testet ohne Hint exakt `2..min(12, letters.length)`, mit Hint genau diese Zahl.
- Crack-Scoring lÃ¤uft Ã¼ber `dictionaryScorer.analyzeTextQuality(...)`; `rawText` bleibt der gepaddete Rohtext.
- Das Scoring trimmt End-`X`, penalisiert interne `X`-HÃ¤ufungen und nutzt Domain-Wort-Boni fÃ¼r kurze Klartexte.

## Columnar Transposition (`js/ciphers/columnarTranspositionCipher.js`)

- Schlüsselbasiert (`supportsKey: true`), akzeptiert numerische Reihenfolge (Permutation `1..N`) oder Keyword.
- Keyword-Parsing: A-Z-Normalisierung inkl. Umlaut-Transliteration, alphabetisches Ranking mit stabilen Ties; Ergebnis ist die Spalten-Lesereihenfolge.
- Normalisierung auf `A-Z`, Padding mit `X` bis Vielfaches der Spaltenanzahl.
- Verschlüsselung: Raster zeilenweise füllen, Spalten in Schlüsselreihenfolge lesen.
- Entschlüsselung: Spalten in Schlüsselreihenfolge füllen, Zeilen lesen.
- `decrypt(...)` liefert Rohtext inkl. Padding; Segmentierung bleibt dem UI-/Crack-Pfad vorbehalten.
- `crack(...)` testet ohne Hint Permutationen für Spaltenanzahlen `2..min(6, letters.length)`, mit `options.keyLength` genau diese Länge.
- Crack nutzt Fallback-Score + Shortlist-Rescoring über `dictionaryScorer.analyzeTextQuality(...)`; `rawText` bleibt gepaddet.
## VigenÃ¨re (`js/ciphers/vigenereCipher.js`)

- SchlÃ¼sselwort-basiert (`supportsKey: true`), Normalisierung auf Buchstaben.
- UnterstÃ¼tzt SchlÃ¼ssellÃ¤ngen-Hinweis fÃ¼rs Knacken (`supportsCrackLengthHint: true`).
- Crack kombiniert:
  - IoC-basierte SchlÃ¼ssellÃ¤ngen-Auswahl
  - spaltenweise Shift-Rangfolge (Chi-Quadrat)
  - budgetierte Suche (`candidateBudget`, `stateBudget`, `evaluationBudget`)
  - Kurztext-Rettungsmodus bei bekannter SchlÃ¼ssellÃ¤nge
  - lokale Suchverfeinerung
  - Sprach-Scoring und Kandidaten-Ranking
- Liefert bestes Ergebnis plus Kandidatenliste.

### Ã„nderungen / Hinweise (aktuell)

- Optimierungsvertrag bleibt unter `options.optimizations`.
  - `false`/unset = Legacy, `true` = Defaults, Objekt = Overrides.
  - Flags: `memoChi`, `incrementalScoring`, `localSearchK`, `progressiveWidening`, `collectStats`.
  - `collectStats` schreibt Telemetrie nach `result.search.telemetry`.
- Bruteforce-Fallback unter `options.bruteforceFallback`:
  - `enabled`, `maxKeyLength` (hart `<=6`), `shortTextMaxLetters`
  - `maxTotalMs`, `maxMsPerLength`, `stageWidths` (Default `[12,18,26]`)
- Fallback ist strikt gate-gebunden; die genaue Gate-/Scoringlogik ist in `docs/SCORING.md` dokumentiert.
- Mit `keyLength`-Hint gilt fÃ¼r den Fallback direkt: `maxElapsedMs = min(remainingTotalMs, maxMsPerLength)`.
- Ohne `keyLength`-Hint bleibt ein adaptives GrÃ¶ÃŸen-Gate aktiv, um teure KurztextfÃ¤lle zu begrenzen.
- `keyLength`-Hint-Normalisierung (Clamp auf testbare BuchstabenlÃ¤nge) und die konsistente
  Nutzung in SchlÃ¼ssellÃ¤ngen-Auswahl, Divisor-Erweiterung und Fallback-Gates sind zentral in
  `docs/SCORING.md` dokumentiert.
- Der Chi-Memo-Cache ist auf `MAX_CHI_MEMO_CACHE_SIZE` begrenzt und wird zu Beginn/Ende jeder Crack-Session geleert.
- ZusÃ¤tzliche Suche-Telemetrie in `result.search`:
  - `bruteforceFallbackTriggered`, `bruteforceFallbackReason`, `bruteforceFallbackKeyLength`
  - `bruteforceCombosVisited`, `bruteforceElapsedMs`, `sense`

## Playfair (`js/ciphers/playfairCipher.js`)

- SchlÃ¼sselbasiert (`supportsKey: true`), SchlÃ¼sselwort wird auf `A-Z` normalisiert.
- Didaktische Fixregeln:
  - `J -> I`
  - nur `A-Z`
  - Bigramme
  - `X` als Filler bei Doppelbuchstaben
  - `X`-Padding bei ungerader LÃ¤nge
- `decrypt(...)` nutzt Entpadding (`A X A` und optionales End-`X`) plus Segmentierung,
  damit die Ausgabe fÃ¼r LernfÃ¤lle lesbar bleibt.
- `decryptRaw(...)` liefert die Rohinversion inklusive didaktischem Padding-`X`.
- Die Segmentierung/QualitÃ¤tsanalyse lÃ¤uft Ã¼ber
  `KryptoCore.dictionaryScorer.analyzeTextQuality(...)`,
  damit Decrypt-Ausgabe und Crack-Bewertung denselben Trennpfad verwenden.
- `segmentText(...)` bleibt kompatibel und spiegelt intern `displayText`.
- Das Sprachmodell dafÃ¼r kommt aus `js/core/segmentLexiconData.js`:
  - normalisierte Exact-Wortbasis aus `de_DE.dic` + `american-english`
  - kompaktes Trigramm-Modell fÃ¼r OOV-Bewertung
- Playfair trennt `PHASE_B_LEXICON_KEYS` (Phase-B-Keykorpus) weiterhin strikt von `PLAYFAIR_SEGMENT_WORDS`.
- `PLAYFAIR_SEGMENT_WORDS` sind nur zusÃ¤tzliche Domain-Hints.
- Boundary-QualitÃ¤t ist zentral:
  - mehr Tokens sind nicht automatisch besser
  - zusÃ¤tzliche Boundaries kosten explizit Score
  - Bridge-WÃ¶rter zÃ¤hlen nur mit starken Nachbarn
  - bei schwachen Boundaries bleibt die Ausgabe konservativ auf `rawText`
- `crack(...)` ist hybrid:
  - Phase A: Shortlist (inkl. `QUANT`, `FAC`)
  - Phase B: erweitertes Key-Corpus (Lexikon + PrÃ¤fix-/Stem-Varianten)
  - AmbiguitÃ¤ts-Gate triggert Fallback bei `low_confidence`, `low_delta`, `low_coverage`
- Crack-Kandidaten enthalten zusÃ¤tzlich `rawText` fÃ¼r die UI-Ausgabe.
- Default-Grenzen:
  - `minConfidence = 11.2`
  - `minDelta = 1.8`
  - `minCoverage = 0.62`
- `result.search` enthÃ¤lt u. a.:
  - `phase`, `fallbackTriggered`, `fallbackReasons`, `gate`

## Pflegehinweis

- Bei Ã„nderungen an Cipher-Verhalten diese Datei und `docs/SCORING.md` synchron aktualisieren.
- Doppelte ErklÃ¤rungen vermeiden: algorithmische Details primÃ¤r in `docs/SCORING.md`.


