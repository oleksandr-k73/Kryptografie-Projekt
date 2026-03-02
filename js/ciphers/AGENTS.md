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
  - exhaustive Suche für `keyLength`-Hint bis Länge 5 (vollständig über `26^5`)
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
- Harte Gate-Bedingung: kurzer Text + niedrige Sinnhaftigkeit + `keyLength <= maxKeyLength`.
- Ohne `keyLength`-Hint greift zusätzlich ein adaptives Größen-Gate (`maxMsPerLength`), um teure Kurztextfälle zu begrenzen.
- Zusätzliche Suche-Telemetrie in `result.search`:
  - `bruteforceFallbackTriggered`, `bruteforceFallbackReason`, `bruteforceFallbackKeyLength`
  - `bruteforceCombosVisited`, `bruteforceElapsedMs`, `sense`

## Pflegehinweis

- Bei Änderungen an Cipher-Verhalten diese Datei und `docs/SCORING.md` synchron aktualisieren.
- Doppelte Erklärungen vermeiden: algorithmische Details primär in `docs/SCORING.md`.
