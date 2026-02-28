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
  - lokale Suchverfeinerung
  - Sprach-Scoring und Kandidaten-Ranking
- Liefert bestes Ergebnis plus Kandidatenliste.

## Pflegehinweis

- Bei Änderungen an Cipher-Verhalten diese Datei und `docs/SCORING.md` synchron aktualisieren.
- Doppelte Erklärungen vermeiden: algorithmische Details primär in `docs/SCORING.md`.
