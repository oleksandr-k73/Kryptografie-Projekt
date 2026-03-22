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
- `info` (purpose/process/crack/useCase/note)

## Cäsar (`js/ciphers/caesarCipher.js`)

- Schlüsselbasiert (`supportsKey: true`), Schlüssel als ganze Zahl.
- Ver-/Entschlüsselung per Verschiebung modulo 26.
- `crack(...)` testet alle 26 Schlüssel.
- Liefert bestes Ergebnis plus `candidates` (Top-Auswahl).

## Zahlen‑Cäsar (`js/ciphers/numberCaesarCipher.js`)

- Schlüsselbasiert (`supportsKey: true`), Schlüssel als ganze Zahl (mod 26).
- Encrypt normalisiert auf `A-Z` (inkl. Umlaut-Transliteration), verschiebt per Cäsar und kodiert strikt als A1Z26 mit `-`-Separatoren.
- Decrypt akzeptiert nur Zahlen `1..26` mit `-`/Whitespace-Separatoren; Rückgabe ist Rohtext ohne Leerzeichen.
- `crack(...)` dekodiert A1Z26 zu Buchstaben, testet 26 Shifts mit der Cäsar-Heuristik und liefert `text`, `rawText`, `key`, `confidence` plus Top‑Kandidaten.
- Segmentierung und Rohtextanzeige laufen im UI‑Pfad über `app.js`, damit Crack/Decrypt konsistent sind.

## Affine (`js/ciphers/affineCipher.js`)

- Schlüsselbasiert (`supportsKey: true`) mit `(a,b)`-Paar.
- Unterstützt editierbares Alphabet (`supportsAlphabet: true`), Standard `ABCDEFGHIJKLMNOPQRSTUVWXYZ`.
- `parseKey(rawKey, { alphabet })` validiert `gcd(a, m) === 1` mit `m = alphabet.length`.
- `crack(...)` testet alle `a` mit `gcd(a,m)=1` und alle `b` in `0..m-1`.
- Crack-Scoring ist identisch zum Cäsar-Verfahren.

## Leetspeak (`js/ciphers/leetCipher.js`)

- Kein Schlüssel (`supportsKey: false`).
- Verschlüsselung per fester Substitutionstabelle.
- Crack nutzt Beam-Search + Sprachbewertung.
- Liefert primär den besten Kandidaten (ohne Kandidatenliste).

## Rail Fence (`js/ciphers/railFenceCipher.js`)

- Schlüsselbasiert (`supportsKey: true`), Schlüssel ist die Schienenanzahl als ganze Zahl `>= 2`.
- Unterstützt Schienen-Hint fürs Knacken (`supportsCrackLengthHint: true`).
- Im UI wird dasselbe Schienen-Feld für Entschlüsselung oder Keyless-Crack verwendet.
- `decrypt(...)` liefert Rohtext; Segmentierung bleibt dem Crack-Pfad vorbehalten.
- `crack(...)` testet ohne Hint `2..min(12, text.length - 1)` und nutzt `options.keyLength` als Schienenanzahl.
- Crack kann `displayText` liefern; `rawText` bleibt separat, damit UI-Rohtext und Segmentierung getrennt bleiben.
- Tie-Breaker: kleinere Rail-Anzahl zuerst.

## Skytale (`js/ciphers/scytaleCipher.js`)

- Schlüsselbasiert (`supportsKey: true`), Schlüssel ist der Umfang (Spaltenanzahl) als ganze Zahl `>= 2`.
- Unterstützt Umfang-Hint fürs Knacken (`supportsCrackLengthHint: true`).
- Im UI wird dasselbe Umfang-Feld für Entschlüsselung oder Keyless-Crack verwendet (`reuseKeyForCrackHint: true`).
- `decrypt(...)` liefert Rohtext inklusive Padding; Segmentierung bleibt dem Crack-Pfad vorbehalten.
- `crack(...)` testet ohne Hint `2..min(12, letters.length)`, mit Hint genau diese Zahl.
- Crack-Scoring nutzt `dictionaryScorer.analyzeTextQuality(...)`; `rawText` bleibt gepaddet.

## Columnar Transposition (`js/ciphers/columnarTranspositionCipher.js`)

- Schlüsselbasiert (`supportsKey: true`), akzeptiert numerische Reihenfolge (Permutation `1..N`) oder Keyword.
- Normalisierung auf `A-Z`, Padding mit `X` bis Vielfaches der Spaltenanzahl.
- `decrypt(...)` liefert Rohtext inkl. Padding; Segmentierung bleibt dem UI-/Crack-Pfad vorbehalten.
- `crack(...)` testet ohne Hint Permutationen für Spaltenanzahlen `2..min(6, letters.length)`, mit `options.keyLength` genau diese Länge.
- Shortlist-Rescoring läuft über `dictionaryScorer.analyzeTextQuality(...)`; `rawText` bleibt gepaddet.

## Positionscipher (`js/ciphers/positionCipher.js`)

- Schlüsselbasiert (`supportsKey: true`), Schlüssel ist eine numerische Permutation `1..N`.
- Normalisierung auf `A-Z`, Padding mit `X` bis Vielfaches der Blocklänge.
- `decrypt(...)` liefert Rohtext inkl. Padding; Segmentierung erfolgt im UI‑Pfad.
- `crack(...)` testet ohne Hint Permutationen für Blocklängen `2..min(6, letters.length)`, mit `options.keyLength` genau diese Länge.
- Crack-Scoring nutzt `dictionaryScorer.analyzeTextQuality(...)`; `rawText` bleibt gepaddet, `text` nutzt segmentierte Anzeige.

## Hill (`js/ciphers/hillCipher.js`)

- Schlüsselbasiert (`supportsKey: true`), Schlüssel ist eine n×n‑Matrix (Ganzzahlen), modulo 26 normalisiert.
- `supportsMatrixKey: true` aktiviert das Matrix-UI; Standard-Key-Input wird ausgeblendet.
- `decrypt(...)` liefert Rohtext inklusive Padding; Segmentierung erfolgt im UI‑Pfad.
- Keyless‑Crack ist ausschließlich für 2×2‑Matrizen aktiv; Bruteforce prüft Werte `0..25` und nur invertierbare Matrizen.
- Crack-Scoring nutzt `dictionaryScorer.analyzeTextQuality(...)`, liefert `displayText` + `rawText` plus Key-String `[[a,b],[c,d]]`.

## XOR (`js/ciphers/xorCipher.js`)

- Schlüsselbasiert (`supportsKey: true`), ASCII 0x00–0x7F, nicht leer.
- Ausgabe ist HEX uppercase ohne Separatoren; Entschlüsselung akzeptiert HEX mit Whitespace.
- Crack nutzt optionalen Längen-Hint (`supportsCrackLengthHint: true`) und printable ASCII 0x20–0x7E.
- Ohne Hint werden die Top‑3 Längen per Base‑Score vorselektiert und Kandidaten k‑best nach Score‑Summe kombiniert (Top‑10 pro Position).
- Crack liefert Klartext (`text`) plus HEX-Rohtext (`rawText`) für die UI-Ausgabe.

## HEX (UTF-8) (`js/ciphers/hexCipher.js`)

- Kein Schlüssel, Crack dekodiert.
- Ausgabe ist uppercase-HEX; Decrypt toleriert Whitespace/Mixed-Case, Fehler bei ungerader Länge/invaliden Zeichen.
- `crack(...)` liefert `rawText` und nutzt segmentiertes `text` nur bei unverändertem Inhalt.

## Base64 (`js/ciphers/base64Cipher.js`)

- Kein Schlüssel (`supportsKey: false`), Crack dekodiert deterministisch.
- UTF-8-sicheres Encode/Decode mit eigener Base64-Logik (kein `btoa/atob`).
- Eingaben sind tolerant: Whitespace wird entfernt, URL-safe (`-`, `_`) wird akzeptiert, fehlendes Padding ergänzt.
- `crack(...)` liefert `rawText` (vollständig decodiert) und nutzt `text` nur segmentiert, wenn der Inhalt erhalten bleibt.
- Confidence kommt aus `dictionaryScorer.analyzeTextQuality(...)` plus Fallback.

## Binärcode (8-Bit) (`js/ciphers/binaryCipher.js`)

- Kein Schlüssel (`supportsKey: false`), Crack dekodiert deterministisch.
- Encrypt kodiert UTF-8-Bytes als 8-Bit-Gruppen mit Leerzeichen.
- Decrypt akzeptiert Whitespace-getrennte Gruppen oder einen durchgehenden 0/1-String (Länge % 8 == 0).
- `crack(...)` liefert `rawText` und nutzt segmentiertes `text` nur bei identischem Inhalt.
- Confidence kommt aus `dictionaryScorer.analyzeTextQuality(...)` plus Fallback.

## ASCII (Dezimalcodes) (`js/ciphers/asciiCipher.js`)

- Kein Schlüssel (`supportsKey: false`), Crack dekodiert deterministisch.
- Encrypt kodiert jedes Zeichen als ASCII-Dezimalwert (0–255), getrennt durch Leerzeichen.
- Decrypt akzeptiert nur whitespace-separierte Dezimalzahlen `0..255`, sonst klare Fehlermeldung.
- `crack(...)` liefert `rawText` (vollständig decodiert) und nutzt segmentiertes `text` nur, wenn der sichtbare Inhalt erhalten bleibt.
- Confidence kommt aus `dictionaryScorer.analyzeTextQuality(...)` plus Fallback.

## RSA Mini (`js/ciphers/rsaMiniCipher.js`)

- Schlüsselbasiert (`supportsKey: true`), Parameter als `p,q,n,e,d` (Labels bevorzugt).
- Eingabe und Ausgabe sind Zahlentokens, getrennt durch Whitespace/Komma/Semikolon.
- `encrypt(...)` benötigt `n` und `e`, `decrypt(...)` benötigt `n` und `d`.
- `crack(...)` erwartet den Hint `d,n` im separaten Feld (`supportsCrackLengthHint: true`).
- Crack ist deterministisch, liefert `confidence = 1` und kein Sprach-Scoring.

## SHA-256 (`js/ciphers/sha256Cipher.js`)

- Kein Schlüssel (`supportsKey: false`); sichere, kryptografische Hashfunktion.
- `encrypt(text)` hashed UTF-8-Input zu 64-stelliger uppercase HEX (deterministisch, keine Kandidaten).
- `decrypt(text)` wirft einen klaren Fehler mit Hinweis auf die Einwegfunktion.
- `crack(text, options)` ist eine Work-in-Progress-Stub:
  - Validiert `text` als gültiger 64-stelliger HEX-Hash.
  - Akzeptiert `options.candidates` als Array von Plaintext-Strings.
  - Bei Match gegen einen Kandidaten: liefert den Plaintext mit `confidence = 100`.
  - Ohne Match oder ohne Kandidaten: liefert `cracked.search.wip = true` + `wipMessage`.
- `info.note` signalisiert WIP-Status dem UI.
- `app.js` erkennt WIP-Status und überspringt Ranking/Kandidaten-Rendering.

## Vigenère (`js/ciphers/vigenereCipher.js`)

- Schlüsselwort-basiert (`supportsKey: true`), Normalisierung auf Buchstaben.
- Unterstützt Schlüssellängen-Hinweis fürs Knacken (`supportsCrackLengthHint: true`).
- Crack kombiniert IoC-Längenwahl, Chi-Rangfolge und budgetierte Suche; Kurztext-Fallback möglich.
- Liefert bestes Ergebnis plus Kandidatenliste; Telemetrie liegt in `result.search`.
- `info.note` wird im Custom-Dropdown als Tooltip genutzt, damit Vigenère-Aliase klar benannt sind.

## Playfair (`js/ciphers/playfairCipher.js`)

- Schlüsselbasiert (`supportsKey: true`), Schlüsselwort wird auf `A-Z` normalisiert.
- `decrypt(...)` nutzt Entpadding plus Segmentierung; `decryptRaw(...)` liefert Rohtext inkl. Padding-`X`.
- Segmentierung/Scoring laufen über `dictionaryScorer.analyzeTextQuality(...)`.
- `crack(...)` ist hybrid (Phase A/Phase B) mit Ambiguitäts-Gate; Kandidaten enthalten `rawText`.

## Pflegehinweis

- Bei Änderungen an Cipher-Verhalten diese Datei und `docs/SCORING.md` synchron aktualisieren.
- Doppelte Erklärungen vermeiden: algorithmische Details primär in `docs/SCORING.md`.


