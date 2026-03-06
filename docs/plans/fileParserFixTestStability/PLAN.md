# PLAN.md: `fileParsers` Bugfixes + Suite-Stabilisierung

## Summary
Ziel ist die Implementierung eines reinen Bugfix-Pakets mit unveränderter App-Funktionalität:
1. Bestätigten JS-Literal-Scoring-Bug in `js/core/fileParsers.js` beheben.
2. Bestätigten CSV-Header-Substring-Bug in `js/core/fileParsers.js` beheben.
3. Reproduzierte Repo-Testinstabilitäten (Timeout/Flakiness) in zwei Vigenere-Testdateien stabilisieren.
4. Vollständige Regression- und Gate-Verifikation durchführen.

## Public APIs / Interfaces / Types
Keine Änderungen an öffentlichen APIs, UI-Verträgen oder Dateiformat-Verträgen.  
Nur interne Parserlogik und Testcode werden angepasst.

## Implementation Plan

### 1) `js/core/fileParsers.js`: JS-Literal-Fallback neutralisieren
- In `extractBestStringFromJs` den `literalRegex`-Fallback-Aufruf ändern:
- von `pushCandidate(decodeJsStringLiteral(match[1]), ["value"])`
- auf `pushCandidate(decodeJsStringLiteral(match[1]), ["_literal"])`
- `assignmentRegex`- und `propertyRegex`-Pfadlogik unverändert lassen.
- Einen Warum-Kommentar ergänzen:
- Fallback-Literale sollen nicht durch den starken Key `value` in `scoreJsonCandidate` bevorzugt werden.
- Konsistenz-Check der betroffenen Symbole durchführen: `literalRegex`, `decodeJsStringLiteral`, `pushCandidate`.

### 2) `js/core/fileParsers.js`: CSV-Textspalte auf Token-Exact-Match umstellen
- `textColumn`-Ermittlung im CSV-Parser ersetzen:
- bisher: `strongTextKeys.includes(h) || strongTextKeys.some((k) => h.includes(k))`
- neu: tokenisierte Header-Prüfung mit exakten Token-Matches.
- Tokenisierung auf gemeinsame Delimiter: `_`, Leerzeichen, `-`.
- Nur Match, wenn mindestens ein Header-Token exakt in `strongTextKeys` enthalten ist.
- Warum-Kommentar ergänzen:
- verhindert False Positives wie `metadata` -> `data`.

### 3) `tests/vitest/feature-proposals-regression.test.mjs`: neue Regressionstests
- Testfall A (JS-Literal-Bonus):
- Sicherstellen, dass Literal-Fallback nicht durch `value`-Bonus falsch priorisiert wird.
- Testfall B (CSV-Substring-Fehler):
- `metadata,message` muss `message`-Spalte wählen, nicht `metadata`.
- Testfall C (Positivfall, optional aber empfohlen):
- `cipher_text` wird weiterhin als Textspalte erkannt.
- Kommentare nach Projektregel mit Fokus auf „Warum“.

### 4) Teststabilisierung ohne Produktionslogik-Änderung
#### Datei: `tests/vitest/vigenere-strategy-and-budgets.test.mjs`
- Die zwei reproduzierten 30s-Timeout-Fälle stabilisieren.
- Timeout-Werte realistisch erhöhen (keine Assertion-Abschwächung).
- Wo möglich deterministische/offline Fetch-Umgebung nutzen, um Laufzeitstreuung zu reduzieren.

#### Datei: `tests/vitest/vigenere-regression.test.mjs`
- Den flakey unhinted/optimized-Fall (unter Vollsuite-Last) durch moderate Timeout-Anpassung stabilisieren.
- Online/Offline-API-Differenztest als Netztest belassen.
- Übrige Fälle deterministisch halten (kein fachlicher Erwartungswechsel).

## Test Cases and Verification

### Parser-spezifische Verifikation
1. JS-Datei mit konkurrierenden Kandidaten (`title` vs. chiffriertes Feld) bleibt semantisch korrekt priorisiert.
2. CSV mit Header `metadata,message` extrahiert die Message-Spalte.
3. CSV mit `cipher_text` bleibt funktional erkannt.

### Vollständige Verifikation (Pflichtreihenfolge)
1. `node --check js/core/fileParsers.js tests/vitest/feature-proposals-regression.test.mjs tests/vitest/vigenere-strategy-and-budgets.test.mjs tests/vitest/vigenere-regression.test.mjs`
2. `node --test tests/docs/*.test.mjs`
3. `./node_modules/.bin/vitest run tests/vitest/*.test.mjs`
4. `./node_modules/.bin/vitest run tests/vitest/*.test.mjs` (zweiter Lauf gegen Flakiness)
5. `node scripts/docs/run_quality_gates.mjs --iterations 25`

## Acceptance Criteria
1. Beide gemeldeten `fileParsers`-Bugs sind behoben.
2. Keine neue Funktionalität, nur Bugfixes/Teststabilisierung.
3. Vollständige Test- und Gate-Läufe sind grün.
4. Kein neuer Fehler in der Repo.
5. Ergebnis ist deterministischer als vorher (insb. bei bisher flakey Tests).

## Assumptions and Defaults
1. Neutraler Fallback-Pfad wird als `["_literal"]` gesetzt.
2. Keine Änderung an Cipher-Produktionslogik.
3. Wegen fehlendem globalem `pnpm` werden lokale Binaries genutzt (`./node_modules/.bin/vitest`).
4. Falls zur Stabilisierung fachliche Assertions geändert werden müssten: stoppen und Rückfrage statt stiller Scope-Änderung.
