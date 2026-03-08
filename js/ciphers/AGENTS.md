# AGENTS.md für `js/ciphers/`

## Zweck

Diese Datei beschreibt den Vertrag und die Besonderheiten der vorhandenen Cipher-Implementierungen.

## Gemeinsamer Cipher-Vertrag

Jeder Cipher erfüllt mindestens:
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

## Cäsar (`js/ciphers/caesarCipher.js`)

- Schlüsselbasiert (`supportsKey: true`), Schlüssel als ganze Zahl.
- Ver-/Entschlüsselung per Verschiebung modulo 26.
- `crack(...)` testet alle 26 Schlüssel.
- Liefert bestes Ergebnis plus `candidates` (Top-Auswahl).

## Leetspeak (`js/ciphers/leetCipher.js`)

- Kein Schlüssel (`supportsKey: false`).
- Verschlüsselung per fester Substitutionstabelle.
- Entschlüsselung delegiert auf Crack-Logik.
- Crack nutzt Beam-Search + Sprachbewertung.
- Liefert primär den besten Kandidaten (ohne Kandidatenliste).

## Vigenère (`js/ciphers/vigenereCipher.js`)

- Schlüsselwort-basiert (`supportsKey: true`), Normalisierung auf Buchstaben.
- Unterstützt Schlüssellängen-Hinweis fürs Knacken (`supportsCrackLengthHint: true`).
- Crack kombiniert:
  - IoC-basierte Schlüssellängen-Auswahl
  - spaltenweise Shift-Rangfolge (Chi-Quadrat)
  - budgetierte Suche (`candidateBudget`, `stateBudget`, `evaluationBudget`)
  - Kurztext-Rettungsmodus bei bekannter Schlüssellänge
  - lokale Suchverfeinerung
  - Sprach-Scoring und Kandidaten-Ranking
- Liefert bestes Ergebnis plus Kandidatenliste.

### Änderungen / Hinweise (aktuell)

- Optimierungsvertrag bleibt unter `options.optimizations`.
  - `false`/unset = Legacy, `true` = Defaults, Objekt = Overrides.
  - Flags: `memoChi`, `incrementalScoring`, `localSearchK`, `progressiveWidening`, `collectStats`.
  - `collectStats` schreibt Telemetrie nach `result.search.telemetry`.
- Bruteforce-Fallback unter `options.bruteforceFallback`:
  - `enabled`, `maxKeyLength` (hart `<=6`), `shortTextMaxLetters`
  - `maxTotalMs`, `maxMsPerLength`, `stageWidths` (Default `[12,18,26]`)
- Fallback ist strikt gate-gebunden; die genaue Gate-/Scoringlogik ist in `docs/SCORING.md` dokumentiert.
- Mit `keyLength`-Hint gilt für den Fallback direkt: `maxElapsedMs = min(remainingTotalMs, maxMsPerLength)`.
- Ohne `keyLength`-Hint bleibt ein adaptives Größen-Gate aktiv, um teure Kurztextfälle zu begrenzen.
- `keyLength`-Hint-Normalisierung (Clamp auf testbare Buchstabenlänge) und die konsistente
  Nutzung in Schlüssellängen-Auswahl, Divisor-Erweiterung und Fallback-Gates sind zentral in
  `docs/SCORING.md` dokumentiert.
- Der Chi-Memo-Cache ist auf `MAX_CHI_MEMO_CACHE_SIZE` begrenzt und wird zu Beginn/Ende jeder Crack-Session geleert.
- Zusätzliche Suche-Telemetrie in `result.search`:
  - `bruteforceFallbackTriggered`, `bruteforceFallbackReason`, `bruteforceFallbackKeyLength`
  - `bruteforceCombosVisited`, `bruteforceElapsedMs`, `sense`

## Playfair (`js/ciphers/playfairCipher.js`)

- Schlüsselbasiert (`supportsKey: true`), Schlüsselwort wird auf `A-Z` normalisiert.
- Didaktische Fixregeln:
  - `J -> I`
  - nur `A-Z`
  - Bigramme
  - `X` als Filler bei Doppelbuchstaben
  - `X`-Padding bei ungerader Länge
- `decrypt(...)` nutzt Entpadding (`A X A` und optionales End-`X`) plus Segmentierung,
  damit die Ausgabe für Lernfälle lesbar bleibt.
- Die Segmentierung/Qualitätsanalyse läuft über
  `KryptoCore.dictionaryScorer.analyzeTextQuality(...)`,
  damit Decrypt-Ausgabe und Crack-Bewertung denselben Trennpfad verwenden.
- `segmentText(...)` bleibt kompatibel und spiegelt intern `displayText`.
- Das Sprachmodell dafür kommt aus `js/core/segmentLexiconData.js`:
  - normalisierte Exact-Wortbasis aus `de_DE.dic` + `american-english`
  - kompaktes Trigramm-Modell für OOV-Bewertung
- Playfair trennt `PHASE_B_LEXICON_KEYS` (Phase-B-Keykorpus) weiterhin strikt von `PLAYFAIR_SEGMENT_WORDS`.
- `PLAYFAIR_SEGMENT_WORDS` sind nur zusätzliche Domain-Hints.
- Boundary-Qualität ist zentral:
  - mehr Tokens sind nicht automatisch besser
  - zusätzliche Boundaries kosten explizit Score
  - Bridge-Wörter zählen nur mit starken Nachbarn
  - bei schwachen Boundaries bleibt die Ausgabe konservativ auf `rawText`
- `crack(...)` ist hybrid:
  - Phase A: Shortlist (inkl. `QUANT`)
  - Phase B: erweitertes Key-Corpus (Lexikon + Präfix-/Stem-Varianten)
  - Ambiguitäts-Gate triggert Fallback bei `low_confidence`, `low_delta`, `low_coverage`
- Default-Grenzen:
  - `minConfidence = 11.2`
  - `minDelta = 1.8`
  - `minCoverage = 0.62`
- `result.search` enthält u. a.:
  - `phase`, `fallbackTriggered`, `fallbackReasons`, `gate`

## Pflegehinweis

- Bei Änderungen an Cipher-Verhalten diese Datei und `docs/SCORING.md` synchron aktualisieren.
- Doppelte Erklärungen vermeiden: algorithmische Details primär in `docs/SCORING.md`.
