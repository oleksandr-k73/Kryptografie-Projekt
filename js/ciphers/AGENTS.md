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

## Affine (`js/ciphers/affineCipher.js`)

- Schlüsselbasiert (`supportsKey: true`) mit `(a,b)`-Paar.
- Unterstützt editierbares Alphabet (`supportsAlphabet: true`), Standard `ABCDEFGHIJKLMNOPQRSTUVWXYZ`.
- Alphabet muss eindeutige Zeichen enthalten; Buchstaben sind case-insensitiv eindeutig.
- Case-Preserving ist immer aktiv (Groß-/Kleinschreibung bleibt erhalten).
- `parseKey(rawKey, { alphabet })` validiert `gcd(a, m) === 1` mit `m = alphabet.length`.
- `crack(...)` testet alle `a` mit `gcd(a,m)=1` und alle `b` in `0..m-1`.
- Crack-Scoring ist identisch zum Cäsar-Verfahren.

## Leetspeak (`js/ciphers/leetCipher.js`)

- Kein Schlüssel (`supportsKey: false`).
- Verschlüsselung per fester Substitutionstabelle.
- Entschlüsselung delegiert auf Crack-Logik.
- Crack nutzt Beam-Search + Sprachbewertung.
- Liefert primär den besten Kandidaten (ohne Kandidatenliste).

## Rail Fence (`js/ciphers/railFenceCipher.js`)

- Schlüsselbasiert (`supportsKey: true`), Schlüssel ist die Schienenanzahl als ganze Zahl `>= 2`.
- Unterstützt Schienen-Hint fürs Knacken (`supportsCrackLengthHint: true`).
- Im UI wird dasselbe Schienen-Feld für Entschlüsselung oder Keyless-Crack verwendet.
- Ver-/Entschlüsselung laufen über den kompletten Zeichenstrom inklusive Leerzeichen und Satzzeichen.
- `decrypt(...)` liefert Rohtext; Segmentierung bleibt dem Crack-Pfad vorbehalten.
- `crack(...)` testet ohne Hint `2..min(12, text.length - 1)` und nutzt `options.keyLength` als Schienenanzahl.
- Crack kann `displayText` liefern; `rawText` bleibt separat, damit UI-Rohtext und Segmentierung getrennt bleiben.
- Tie-Breaker: kleinere Rail-Anzahl zuerst.

## Skytale (`js/ciphers/scytaleCipher.js`)

- Schlüsselbasiert (`supportsKey: true`), Schlüssel ist der Umfang (Spaltenanzahl) als ganze Zahl `>= 2`.
- Unterstützt Umfang-Hint fürs Knacken (`supportsCrackLengthHint: true`).
- Im UI wird dasselbe Umfang-Feld für Entschlüsselung oder Keyless-Crack verwendet (`reuseKeyForCrackHint: true`).
- Normalisierung auf `A-Z` (inkl. Umlaut-Transliteration), Padding mit `X` bis Vielfaches des Umfangs.
- Verschlüsselung: Spalten füllen, Zeilen lesen. Entschlüsselung: Zeilen füllen, Spalten lesen.
- `decrypt(...)` liefert Rohtext inklusive Padding; Segmentierung bleibt dem Crack-Pfad vorbehalten.
- `crack(...)` testet ohne Hint `2..min(12, letters.length)`, mit Hint genau diese Zahl.
- Crack-Scoring nutzt `dictionaryScorer.analyzeTextQuality(...)`; `rawText` bleibt gepaddet.

## Columnar Transposition (`js/ciphers/columnarTranspositionCipher.js`)

- Schlüsselbasiert (`supportsKey: true`), akzeptiert numerische Reihenfolge (Permutation `1..N`) oder Keyword.
- Keyword-Parsing: A-Z-Normalisierung inkl. Umlaut-Transliteration, alphabetisches Ranking mit stabilen Ties; Ergebnis ist die Spalten-Lesereihenfolge.
- Normalisierung auf `A-Z`, Padding mit `X` bis Vielfaches der Spaltenanzahl.
- Verschlüsselung: Raster zeilenweise füllen, Spalten in Schlüsselreihenfolge lesen.
- Entschlüsselung: Spalten in Schlüsselreihenfolge füllen, Zeilen lesen.
- `decrypt(...)` liefert Rohtext inkl. Padding; Segmentierung bleibt dem UI-/Crack-Pfad vorbehalten.
- `crack(...)` testet ohne Hint Permutationen für Spaltenanzahlen `2..min(6, letters.length)`, mit `options.keyLength` genau diese Länge.
- Shortlist-Rescoring läuft über `dictionaryScorer.analyzeTextQuality(...)`; `rawText` bleibt gepaddet.
## Vigenère (`js/ciphers/vigenereCipher.js`)

- Schlüsselwort-basiert (`supportsKey: true`), Normalisierung auf Buchstaben.
- Unterstützt Schlüssellängen-Hinweis fürs Knacken (`supportsCrackLengthHint: true`).
- Crack kombiniert IoC-Längenwahl, Chi-Rangfolge und budgetierte Suche; Kurztext-Fallback möglich.
- `options.optimizations` und `options.bruteforceFallback` steuern Optimierungs-/Fallbackpfade (Details in `docs/SCORING.md`).
- Liefert bestes Ergebnis plus Kandidatenliste; Telemetrie liegt in `result.search`.

## Playfair (`js/ciphers/playfairCipher.js`)

- Schlüsselbasiert (`supportsKey: true`), Schlüsselwort wird auf `A-Z` normalisiert.
- Didaktische Fixregeln:
  - `J -> I`
  - nur `A-Z`
  - Bigramme
  - `X` als Filler bei Doppelbuchstaben
  - `X`-Padding bei ungerader Länge
- `decrypt(...)` nutzt Entpadding plus Segmentierung; `decryptRaw(...)` liefert Rohtext inkl. Padding-`X`.
- Segmentierung/Scoring laufen über `dictionaryScorer.analyzeTextQuality(...)`.
- `crack(...)` ist hybrid (Phase A/Phase B) mit Ambiguitäts-Gate; Kandidaten enthalten `rawText`.

## Pflegehinweis

- Bei Änderungen an Cipher-Verhalten diese Datei und `docs/SCORING.md` synchron aktualisieren.
- Doppelte Erklärungen vermeiden: algorithmische Details primär in `docs/SCORING.md`.


