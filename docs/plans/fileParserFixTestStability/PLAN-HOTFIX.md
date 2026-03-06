# PLAN.md — Escape-Decoding-Fix in `fileParsers` (Hand-Off)

## Summary
Der Befund ist bestätigt: Die Escape-Decode-Kette in `decodeJsStringLiteral` verarbeitet überlappende Escapes fehlerhaft.  
Betroffene Fälle sind insbesondere doppelt escapte Sequenzen (`\\n`, `\\uXXXX`, `\\xXX`).  
Ziel ist ein reiner Bugfix ohne API-/Funktionsänderung außerhalb dieses Decode-Verhaltens.

## Public APIs / Interfaces / Types
Keine Änderungen an öffentlichen APIs, UI-Verträgen oder Dateiformaten.

## Umsetzung

### 1. `js/core/fileParsers.js`: Decode-Logik robust machen
1. In `decodeJsStringLiteral` die aktuelle mehrstufige `replace(...)`-Kette ersetzen.
2. Eine Single-Pass-Unescape-Logik einführen, die links-nach-rechts verarbeitet und Overlap verhindert.
3. In einem zentralen Match-Callback behandeln:
1. `\\uXXXX`
2. `\\xXX`
3. einfache Escapes: `\\n`, `\\r`, `\\t`, `\\'`, `\\"`, `\\\\`
4. Bestehendes Verhalten für Template-Bereinigung (`${...}`) unverändert lassen.
5. Einen Warum-Kommentar ergänzen (Overlap-Bugs durch mehrfache Replace-Ketten vermeiden).

### 2. `tests/vitest/feature-proposals-regression.test.mjs`: Regression absichern
1. Testfall: `message: "A\\\\nB"` muss als `A\\nB` bleiben (kein realer Zeilenumbruch).
2. Testfall: `message: "\\\\u0041"` muss `\\u0041` bleiben (nicht `\\A`).
3. Testfall: `message: "\\\\x41"` muss `\\x41` bleiben (nicht `\\A`).
4. Positivtest: `message: "\\u0041"` und `message: "\\x41"` decodieren weiterhin zu `A`.
5. Kommentare mit Fokus auf „Warum“.

## Tests / Verifikation
1. `node --check js/core/fileParsers.js tests/vitest/feature-proposals-regression.test.mjs`
2. `node --test tests/docs/*.test.mjs`
3. `./node_modules/.bin/vitest run tests/vitest/feature-proposals-regression.test.mjs`
4. `./node_modules/.bin/vitest run tests/vitest/*.test.mjs`
5. `./node_modules/.bin/vitest run tests/vitest/*.test.mjs`
6. `node scripts/docs/run_quality_gates.mjs --iterations 25`

## Abgabekriterien
1. Der bestätigte Escape-Bug ist vollständig behoben.
2. Keine neuen Fehler oder Regressionen.
3. Relevante Tests und Gates sind grün.
4. Funktionalität bleibt gleich, außer dem korrigierten Bugverhalten.
5. Keine zusätzlichen Dependencies.

## Annahmen / Defaults
1. Bevorzugte Lösung ist Single-Pass-Unescape (statt nur Reihenfolge tauschen).
2. Keine Änderung an Cipher-Produktionslogik.
3. Falls unerwartete Nebenwirkungen außerhalb des Decodings nötig wären: stoppen und Rückfrage.

