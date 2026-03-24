---
name: cipher-new-method
description: Leitfaden zur Implementierung und zum Debugging eines neuen Verschlüsselungsverfahrens mit verbindlicher Doku-Reihenfolge, Cipher-Vertrag und reproduzierbaren Gates.
---

# Neues Verschlüsselungsverfahren

## Verbindliche Reihenfolge (Doku-Gate)

Vor Implementierung/Debugging diese Quellen in dieser Reihenfolge lesen:

1. `AGENTS.md`
2. `docs/DATENFLUSS.md`
3. `docs/SCORING.md`
4. `js/ciphers/AGENTS.md`

Abbruchregel:
- Wenn eine Entscheidung daraus nicht eindeutig ableitbar ist, nachfragen statt raten.

## Implementierungs-Workflow

1. Datei `js/ciphers/<cipherFile>.js` anlegen.
2. IIFE-Muster verwenden und Cipher an `window.KryptoCiphers` anhängen.
3. Cipher-Vertrag vollständig umsetzen:
- `id` (eindeutig, string)
- `name` (string)
- `encrypt(text, key?)`
- `decrypt(text, key?)`
- `crack(text, options?)`
4. Optionale Metadaten nur bei fachlichem Bedarf setzen:
- `supportsKey`
- `parseKey(rawKey)`
- `keyLabel`, `keyPlaceholder`
- `supportsCrackLengthHint`
- `crackLengthLabel`, `crackLengthPlaceholder`
- `info: { purpose, process, crack, useCase }`
5. Crack-Rückgabeform einhalten:
- mindestens `{ key, text, confidence }`
- optional `candidates` als absteigend nach `confidence` sortierbare Liste
6. In `index.html` neues Cipher-Script vor `js/app.js` einbinden.

## Script-Reihenfolge (Integration)

- Core-Module vor Cipher-Modulen laden.
- `js/core/segmentLexiconData.js` vor `js/core/dictionaryScorer.js`, damit das Offline-Lexikon da ist.
- Cipher-Script in `index.html` vor `js/app.js`, damit die Registrierung steht.

## Optionale UI-/Integrations-Flags

Diese Flags nur setzen, wenn sie fachlich nötig sind:
- `supportsAlphabet`, `defaultAlphabet`, `alphabetLabel`, `alphabetPlaceholder`, `normalizeAlphabet`
- `supportsMatrixKey`
- `reuseKeyForCrackHint`
- `info.note`

## Debugging-Workflow

Startkommandos für reproduzierbare Prüfung:
- `pnpm run test:node`, `pnpm run test:vitest`, `pnpm run test:gates`

Kurzablauf:
1. Reproduktions-Check
2. Input-/Output-Nachverfolgung (inkl. `parseInputFile(...)`)
3. Cipher-Isolation (ohne UI)
4. Kandidatenanalyse + Sortierbarkeit
5. Dictionary-Reranking + Fallback-Pfad prüfen
6. Regressions-Check mit festen Baselines
7. Einbindungs-Check (Script-Reihenfolge)

## Verifikation und Freigabekriterien

1. Alle Checks aus `references/debug-checklist.md` müssen grün sein.
2. Registrierung über `CipherRegistry.register(...)` muss ohne Fehler laufen.
3. Bei `supportsKey: true` gilt: `decrypt(encrypt(text, key), key) === text`.
4. Bei `supportsKey: false` müssen `encrypt`, `decrypt`, `crack` stabil laufen und String-Outputs liefern.
5. Crack-Ergebnis muss verarbeitbar sein:
- `text` ist String
- `confidence` ist Number
- `key` ist vorhanden, wenn das Verfahren einen Schlüssel ableitet
- `candidates` sind bei Mehrkandidaten-Verfahren plausibel und sortierbar
6. Regressionsfälle dürfen nicht unbegründet schlechter werden.
7. Doku-Synchronität muss bestehen:
- neue Cipher-Details in `js/ciphers/AGENTS.md`
- Scoring-/Ranking-Änderungen in `docs/SCORING.md`
- Laufzeitpfad/Fallback-Änderungen in `docs/DATENFLUSS.md`
