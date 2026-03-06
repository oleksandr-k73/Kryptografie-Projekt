# PLAN.md: Vigenère-Bruteforce-Fallback mit 100er-Iterationslauf und 1k-Abschlusstest

## Zusammenfassung
1. Wir bauen ein Bruteforce-Fallback in `vigenereCipher.crack`, das nur bei kurzen Texten, niedriger Sinnhaftigkeit und kleiner Schlüssellänge aktiviert wird.
2. Für Optimierungsiterationen nutzen wir einen deterministischen **100-Fälle-Lauf mit zufälliger Schlüssellänge**.
3. Für die finale Abnahme nutzen wir einen deterministischen **1k-Stresstest**.
4. Die UI zeigt vor dem Cracken klar an, dass Bruteforce laufen kann und der Nutzer warten muss.
5. Die Dokumentation trennt Projektregeln (Root-`AGENTS.md`) von cipher-spezifischem Vertrag (`js/ciphers/AGENTS.md`).

## Öffentliche API-/Interface-Änderungen
1. `vigenereCipher.crack(text, options)` bleibt kompatibel.
2. Neu in `options`:
   1. `bruteforceFallback.enabled` (Default `true`)
   2. `bruteforceFallback.maxKeyLength` (Default `5`, hart `<=6`)
   3. `bruteforceFallback.shortTextMaxLetters` (Default `22`)
   4. `bruteforceFallback.maxTotalMs` (Default `30000`)
   5. `bruteforceFallback.maxMsPerLength` (Default `12000`)
   6. `bruteforceFallback.stageWidths` (Default `[12,18,26]`)
3. Neu in `result.search`:
   1. `bruteforceFallbackTriggered`
   2. `bruteforceFallbackReason`
   3. `bruteforceFallbackKeyLength`
   4. `bruteforceCombosVisited`
   5. `bruteforceElapsedMs`
   6. `sense` mit `senseScore`, `meaningfulTokenRatio`, `nonsenseRatio`, `dictCoverageProxy`

## Implementierungsschritte

### 1) Bruteforce-Gating und Qualitätsmetriken in `js/ciphers/vigenereCipher.js`
1. Neue Funktion `evaluateSenseMetrics(text)`:
   1. `dictCoverageProxy`
   2. `meaningfulTokenRatio`
   3. `nonsenseRatio = 1 - meaningfulTokenRatio`
   4. `gibberishBigramRatio`
   5. `senseScore = 0.50*dictCoverageProxy + 0.35*meaningfulTokenRatio + 0.15*(1-gibberishBigramRatio)`
2. Neue Gate-Funktion `shouldTriggerBruteforceFallback(...)` mit UND-Bedingungen:
   1. Text kurz (`letters <= shortTextMaxLetters`)
   2. Kandidat schwach (`dictCoverageProxy <= 0.34`, `senseScore <= 0.40`, `nonsenseRatio >= 0.60`)
   3. `keyLength <= maxKeyLength`
3. Neue staged Bruteforce-Funktion:
   1. Stage 1: Top-12 je Spalte
   2. Stage 2: Top-18 je Spalte
   3. Stage 3: Top-26 je Spalte (voll)
4. Kandidatenscore:
   1. `scoreLanguage`
   2. `+ dictionaryBoostScore`
   3. `+ senseBonus` aus `senseScore` und `meaningfulTokenRatio`
5. Merge-Regel:
   1. Fallback-Ergebnis ersetzt Basis nur bei klarer Qualitätsverbesserung
   2. Sonst bleibt Basis erhalten

### 2) Nutzerhinweis „Bruteforce läuft, bitte warten“ in `js/app.js`
1. Vor `cipher.crack(...)`:
   1. Status setzen: `Vigenère: Bruteforce-Prüfung läuft gegebenenfalls, bitte warten ...`
   2. `runButton` deaktivieren
   3. `await new Promise((r) => requestAnimationFrame(r))`, damit Hinweis sichtbar wird
2. Nach Crack:
   1. `runButton` reaktivieren
   2. Status ergänzen:
      1. wenn `search.bruteforceFallbackTriggered=true`: Laufhinweis + Dauer
      2. sonst normaler Crack-Status

### 3) Datengeneratoren (deterministisch, seeded)
1. Neue Datei `tests/vitest/generators/vigenereFallbackDatasets.js`.
2. Exportiert:
   1. `generateIteration100(seed=42)`
   2. `generateFinalStress1000(seed=42)`
3. `generateIteration100`:
   1. N=100
   2. zufällige Schlüssellänge mit fester Quote:
      1. 40 Fälle: L in `[2,4]`
      2. 40 Fälle: L in `[5,6]`
      3. 20 Fälle: L in `[7,9]`
   3. Reihenfolge seeded gemischt
4. `generateFinalStress1000`:
   1. N=1000
   2. zufällige Schlüssellänge mit fester Quote:
      1. 700 Fälle: L in `[2,6]` (Bruteforce-eligible)
      2. 300 Fälle: L in `[7,10]` (Gate-off Kontrollanteil)
   3. Reihenfolge seeded gemischt

### 4) Tests
1. Neue Testdatei `tests/vitest/vigenere-bruteforce-iteration100.test.mjs`.
2. Neue Testdatei `tests/vitest/vigenere-bruteforce-final1k.test.mjs`.
3. Neue Pflichtfall-Fixture `tests/vitest/fixtures/vigenere-bruteforce-required-cases.json`.
4. Iterations-100-Assertions:
   1. Pflichtfälle bestehen
   2. Erfolgsrate `>= 0.90`
   3. Laufzeit `< 20 Minuten`
   4. deterministisch bei gleichem Seed
5. Final-1k-Assertions:
   1. Erfolgsrate `>= 0.88`
   2. Laufzeit `< 60 Minuten`
   3. kein Crash/Timeout
   4. bruteforce-telemetry konsistent
6. Mathe-/Trigger-Tests:
   1. Grenzwerte (`22/23`, `5/6`, Scoregrenzen)
   2. Kombinatorik je Stage (falls nicht budget-abgebrochen)
   3. deterministische Sortierung/Top-K-Reihenfolge

### 5) Doku-Updates
1. `AGENTS.md`:
   1. Root enthält nur Verweis: Vigenère-Detailvertrag in `js/ciphers/AGENTS.md`
2. `js/ciphers/AGENTS.md`:
   1. neuer Abschnitt `Vigenère-Optimierungs- und Fallback-Vertrag`
3. `docs/SCORING.md`:
   1. Sense-Formel
   2. staged Bruteforce
   3. Merge-Regel
4. `docs/DATENFLUSS.md`:
   1. UI-Wartehinweis
   2. Fallback-Triggerpfad
   3. neue Telemetrie-Felder

## Ausführungsreihenfolge (Implementierungsworkflow)
1. Cipher-Änderungen + Telemetrie.
2. UI-Hinweis + Button-Disable/Enable.
3. Generator + 100er-Test.
4. Pflichtfall-Assertions.
5. 1k-Test hinzufügen.
6. Doku synchronisieren.
7. Laufreihenfolge:
   1. `node --check js/ciphers/vigenereCipher.js`
   2. `pnpm vitest run tests/vitest/vigenere-bruteforce-iteration100.test.mjs --testTimeout=1200000`
   3. `pnpm vitest run tests/vitest/vigenere-bruteforce-final1k.test.mjs --testTimeout=3600000`
   4. `pnpm run test:vitest`

## Akzeptanzkriterien
1. Iterations-100-Test ist grün.
2. Final-1k-Test ist grün.
3. Final-1k läuft unter 1 Stunde.
4. Nutzer sieht vor dem Crack eindeutig den Wartehinweis.
5. Keine neuen Dependencies.
6. Doku vollständig aktualisiert.

## Annahmen und Defaults
1. „Zufällige Schlüssellänge“ ist seeded-zufällig mit fixer Verteilung für Reproduzierbarkeit.
2. Bruteforce wird nur bis `maxKeyLength` aktiviert; Default bleibt `5`.
3. Offline-stabile Tests sind priorisiert, daher keine harte Abhängigkeit von `dictionaryapi.dev` im Gate.


