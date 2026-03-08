# Hand-Out: Endgültiger Fix-Plan für Playfair-Übersegmentierung und Vigenère-Regressionen

## Zusammenfassung
- Der frühere Plan wurde weitgehend umgesetzt, aber nicht endgültig gelöst.
- Der verbleibende Hauptfehler ist strukturell: `js/core/dictionaryScorer.js` übersegmentiert lange plausible Klartextläufe in kurze bekannte Wörter und bewertet diese Splits zu hoch.
- Belegt:
  - `PQHOYFKUEFSMKHTNIZ` wird mit korrekt gefundenem Schlüssel `QUANT` falsch als `MACH ZEHN DER SIGNAL` ausgegeben.
  - `segmentText("MACHZEHNDERSIGNAL")` liefert derzeit falsch `MACH ZEHN DER SIGNAL`.
  - `segmentText("PHASENVERSCHIEBUNG")` liefert derzeit fragwürdig `PHASEN VERS CHIE BUNG`.
- Zweites Strukturproblem:
  - Playfair-internes Kandidatenscoring und `dictionaryScorer.rankCandidates(...)` verwenden unterschiedliche lokale Qualitätsmodelle.
  - Das ist regressionsanfällig und muss vereinheitlicht werden.
- Für den gemeldeten Vigenère-Fall ist aktuell nur sicher:
  - Es gibt noch keinen exakten Regressionstest für den langen `PHASE`-Fall ohne Hint.
  - Der Fix muss reproduktionsgetrieben erfolgen: erst Test, dann Code.

## Wichtiger Kontext aus dem aktuellen Repo-Zustand
- `js/core/segmentLexiconData.js` existiert bereits und wird vor `js/core/dictionaryScorer.js` geladen.
- `js/core/dictionaryScorer.js` enthält bereits:
  - Exact-/Hint-/Suffix-/Unknown-Word-Klassen
  - OOV-Trigramm-Modell
  - Bridge-Wort-Logik
  - Refinement über `splitLongOovToken(...)`, `refineSingleTokenBridgeSplits(...)`, `refineBridgeContinuations(...)`
- Der eigentliche Defekt sitzt in genau diesen Refinement-/Boundary-Entscheidungen.
- `js/ciphers/playfairCipher.js` nutzt weiterhin `PLAYFAIR_SEGMENT_WORDS` als zusätzliche Domain-Hints.
- Die bisherigen Playfair-Tests decken `FOTONEN`, `IMPULS`, `KOHARENZ` ab, aber nicht die Fehlerklasse „lange plausible Form wird in kurze bekannte Wörter zerschnitten“.
- Gewählter Produkt-Default:
  - Komposita/zusammenhängende Fachbegriffe sollen konservativ behandelt werden.
  - Wenn eine Segmentierung nicht klar besser ist, bleibt die Originalform für die Anzeige erhalten.

## Implementierungsplan
### 1. Shared-Textanalyse zentralisieren
- In `js/core/dictionaryScorer.js` eine interne zentrale Analysefunktion einführen, z. B. `analyzeTextQuality(text, options)`.
- Diese Funktion wird die einzige Quelle für:
  - Segmentierungsmetriken
  - Boundary-Stärke
  - OOV-/Lexikon-Balance
  - Anzeigeentscheidung
- Rückgabe intern:
  - `rawText`
  - `displayText`
  - `displayTokens`
  - `scoreTokens`
  - `coverage`
  - `meaningfulTokenRatio`
  - `unknownRatio`
  - `confidence`
  - `strongSegmentRatio`
  - `averageTokenScore`
  - `plausibleOovRatio`
  - `supportedBridgeRatio`
  - `weakBoundaryCount`
  - `unsupportedBridgeCount`
  - `shortTokenCount`
  - `lexiconCoverage`
- Öffentliche API kompatibel halten:
  - `segmentText(...)` bleibt erhalten
  - `segmentText(...).text` = `displayText`
  - `segmentText(...).tokens` = `displayTokens`

### 2. Segmentierungslogik von „Split-first“ auf „Boundary-proof-first“ umstellen
- Die aktuelle Refinement-Logik nicht nur mit Schwellen patchen, sondern auf Boundary-Qualität umbauen.
- Neue Regeln:
  - Mehr Tokens sind nicht automatisch besser.
  - Jede neue Boundary kostet explizit Score.
  - Zusätzliche kurze Tokens `< 4` sind grundsätzlich verdächtig.
  - Bridge-Wörter (`der`, `und`, `die`, `im`, `one`, `are`, `ihr` usw.) dürfen nur zählen, wenn beide Nachbarn stark sind.
  - Ein plausibler langer `unknown_word` bleibt erhalten, wenn der Split keine klare Netto-Verbesserung bringt.
- Konkrete Entscheidungskriterien:
  - Replacement mit mehr Tokens gewinnt nur bei klar höherer `confidence` und nicht fallender `strongSegmentRatio`.
  - Replacement mit neuen Bridge-Tokens verliert, wenn `unsupportedBridgeCount > 0`.
  - Replacement mit mehreren kurzen Exact-Tokens braucht deutlich höhere Schwelle als heute.
  - Lange OOV-/Fachwortformen dürfen nicht durch bloß lokale Lexikontreffer zerlegt werden.

### 3. Anzeige konservativ machen
- `displayText` darf nicht identisch aus dem aggressivsten Split kommen.
- Wenn die beste Analyse schwache Boundaries enthält:
  - `displayText = rawText`
  - nicht die aufgesplittete Form ausgeben
- Damit werden falsche Anzeigen wie `MACH ZEHN DER SIGNAL` unterbunden, auch wenn intern Score-Tokens noch geprüft werden.

### 4. Playfair auf Shared-Analyse umstellen
- In `js/ciphers/playfairCipher.js`:
  - `scoreCandidateText(...)` nur noch aus der neuen Shared-Analyse speisen
  - `decrypt(...)` und finale `crack(...)`-Ausgabe auf `displayText` basieren
  - keine zusätzliche Anzeige-Re-Segmentierung außerhalb der Shared-Analyse
- `PLAYFAIR_SEGMENT_WORDS` nicht weiter ausbauen.
- Wenn die Shared-Analyse nach der Umstellung stabil genug ist:
  - `PLAYFAIR_SEGMENT_WORDS` nur noch als optionale Domain-Hints für Spezialfälle behalten
  - nicht mehr als tragende Säule des Fixes behandeln

### 5. Lokales Wörterbuch-Ranking vereinheitlichen
- `rankCandidates(...)` in `js/core/dictionaryScorer.js` nicht länger primär über `extractWords(...)` + `localWordMatchScore(...)` laufen lassen.
- Stattdessen dieselbe Shared-Analyse nutzen wie Playfair.
- Lokaler Kandidatenscore soll zusätzlich berücksichtigen:
  - `lexiconCoverage`
  - `weakBoundaryCount`
  - `unsupportedBridgeCount`
  - `shortTokenCount`
  - `plausibleOovRatio`
- Ziel:
  - Playfair-Scoring und globales Wörterbuch-Ranking dürfen nicht auseinanderlaufen.

### 6. Vigenère reproduktionsgetrieben absichern
- Exakten Regressionstest für den gemeldeten langen Ciphertext ergänzen:
  - ohne `keyLength`
  - mit `keyLength: 5`
- Erwartung in beiden Fällen:
  - Schlüssel `PHASE`
  - Klartext `IM DOPPELSPALTEXPERIMENT ERZEUGEN EINZELNE ELEKTRONEN EIN INTERFERENZMUSTER UND ZEIGEN DAMIT DASS MATERIE WELLENCHARAKTER BESITZEN KANN`
- Falls der Core-Test direkt grün bleibt:
  - zusätzlichen App-Pfad-Test für `js/app.js` ergänzen
  - minimalen DOM-/VM-Harness aufbauen
  - verifizieren, dass derselbe Text im UI-Pfad ebenfalls `PHASE` als Sieger liefert
- Nur den tatsächlich fehlerhaften Pfad ändern:
  - Core, wenn Core-Test fehlschlägt
  - App-/Ranking-Pfad, wenn nur UI abweicht

## Tests
### Pflicht-Regressionen für Playfair
- `segmentText("MACHZEHNDERSIGNAL").text === "MACHZEHNDERSIGNAL"`
- `segmentText("PHASENVERSCHIEBUNG").text === "PHASENVERSCHIEBUNG"`
- `compactLetters(playfair.decrypt("PQHOYFKUEFSMKHTNIZ", "QUANT")) === "MACHZEHNDERSIGNAL"`
- `playfair.crack("PQHOYFKUEFSMKHTNIZ", { keyCandidates }).key === "QUANT"`
- `compactLetters(playfair.crack(...).text) === "MACHZEHNDERSIGNAL"`

### Bestehende Playfair-Pflichtfälle müssen grün bleiben
- `CSUSEKTEFKIA -> FOTONEN FELD`
- `CSUSEKTRKHTNIZ -> FOTONEN SIGNAL`
- `GPOASZATEFEKMKKD -> IMPULS UND ENERGIE`
- `CFYKHOEKIPCYFKKF -> BERECHNE DIE WELLE`
- `QDLANONABLQDFNPNKAKAIV -> ABITUR AUFGABE TRAINING`

### 1k-Gate erweitern
- Fester Pflichtfall mit Buchstabenfolge `MACHZEHNDERSIGNAL` in `tests/vitest/generators/playfairDataset.js`
- Presence im `playfair-keyless-e2e-1k`-Test explizit prüfen

### Vigenère-Regressionen
- Exakter Nutzerfall ohne Hint
- Exakter Nutzerfall mit `keyLength: 5`
- Falls nötig zusätzlicher App-Pfad-Test

## Verifikation
- `node --check js/core/dictionaryScorer.js`
- `node --check js/ciphers/playfairCipher.js`
- `node --check js/app.js`
- `node --check tests/vitest/playfair-regression.test.mjs`
- `node --check tests/vitest/playfair-keyless-e2e-1k.test.mjs`
- `node --check tests/vitest/vigenere-regression.test.mjs`
- `./node_modules/.bin/vitest run tests/vitest/playfair-regression.test.mjs tests/vitest/playfair-keyless-e2e-1k.test.mjs tests/vitest/vigenere-regression.test.mjs`
- `pnpm run test:vitest`
- `pnpm run test:gates`
- abschließend `pnpm run test`

## Doku
- `docs/SCORING.md`
- `docs/DATENFLUSS.md`
- `js/ciphers/AGENTS.md`
- Dokumentieren:
  - zentrale Shared-Textanalyse
  - konservative Anzeige bei schwachen Boundaries
  - vereinheitlichte lokale Kandidatenbewertung

## Annahmen und Defaults
- Keine Änderung an Playfair-Transform, Playfair-Keysuche oder Playfair-Gates, solange die neuen Regressionen das nicht erzwingen.
- Keine neuen Dependencies.
- Keine manuellen Wortlisten als Hauptfix.
- Default-Ausgabe ist konservativ: bei unsicherer Segmentierung bleibt die Originalform erhalten.

