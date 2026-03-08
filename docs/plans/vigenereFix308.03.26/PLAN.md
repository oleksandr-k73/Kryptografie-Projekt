# Vigenère-Fix: unhinted Längenselektion verliert die echte Periodenlänge

## Zusammenfassung
- Der Bug ist eindeutig in `candidateLengths()` in [js/ciphers/vigenereCipher.js](/home/mrphaot/Dokumente/Kryptografie-Projekt/js/ciphers/vigenereCipher.js) lokalisiert, nicht in `dictionaryScorer`, nicht in `decrypt`, nicht im allgemeinen Frequenz-Scoring.
- Reproduzierter Befund für den QUANT-Fall:
  - `candidateLengths(..., null, optimizations=true)` liefert aktuell `10,3,13,1,7,2,4,6`.
  - Die echte Länge `5` fehlt komplett.
  - `crackWithLength(cipher, 5, false, { optimizations: true })` liefert sofort korrekt `QUANT` plus den exakten Klartext.
- Damit ist die eigentliche Frequenzanalyse für Länge `5` intakt. Der Fehler ist: Der unhinted Pfad lässt die echte Länge gar nicht erst in die Suche.
- Die falschen 10er-Kandidaten (`QTGNTQUANT` usw.) sind nur ein Folgeeffekt davon, dass ausschließlich Länge `10` untersucht wird; dort reichen die unhinted Optionen/`localSearchK` nicht bis zum perfekten Wiederholungsschlüssel. Das ist für diesen Bug nicht die Ursache und muss nicht mitgefixt werden.

## Exakter Root Cause
- `candidateLengths()` bewertet Längen nur über `quality: -Math.abs(ioc - 0.066)`.
- Bei periodischen Schlüsseln kann ein Vielfaches der echten Länge einen IoC-Wert liefern, der näher an `0.066` liegt als die echte Länge selbst.
- Im QUANT-Fall:
  - `IoC(5) = 0.0906`
  - `IoC(10) = 0.0780`
  - Weil `0.0780` näher an `0.066` liegt, gewinnt Länge `10` gegen Länge `5`.
- Danach wird im unhinted Pfad nur die Top-Auswahl geprüft; Länge `5` wird abgeschnitten.
- Beweis, dass kein anderer Bug das Problem treibt:
  - Der direkte Längenlauf für `5` ist korrekt.
  - Eine In-Memory-Patch-Simulation, die nur die Längenselektion erweitert, löst den QUANT-Fall sofort und hält BRICK/PHASE stabil.

## Implementierungsänderung
- Ziel: Wenn ein unhinted Top-Kandidat ein Vielfaches ist, müssen plausible Teilerlängen im Suchraum bleiben.
- Keine Änderungen an `scoreLanguage`, `dictionaryScorer`, `localSearchK`, Budgets oder Bruteforce-Logik.
- Kein API-Change.

```js
function candidateLengths(text, keyLengthHint, optimizationContext) {
  const lettersCount = extractLettersUpper(text).length;
  if (lettersCount === 0) {
    return [1];
  }

  if (keyLengthHint != null) {
    const hinted = Math.max(1, Math.min(Math.floor(keyLengthHint), lettersCount));
    return [hinted];
  }

  const widenRange = optimizationContext && optimizationContext.enabled;
  let maxLen = 12;
  if (lettersCount < 10) {
    maxLen = widenRange ? 4 : 3;
  } else if (lettersCount < 14) {
    maxLen = widenRange ? 6 : 4;
  } else if (lettersCount < 20) {
    maxLen = widenRange ? 8 : 5;
  } else if (lettersCount < 40) {
    maxLen = widenRange ? 10 : 8;
  } else if (widenRange) {
    maxLen = 14;
  }
  maxLen = Math.min(maxLen, Math.max(1, Math.floor(lettersCount / 2)));

  const scored = [];
  for (let len = 1; len <= maxLen; len += 1) {
    const ioc = avgIocForLength(text, len);
    scored.push({
      len,
      ioc,
      quality: -Math.abs(ioc - 0.066),
    });
  }

  scored.sort((a, b) => b.quality - a.quality);
  const keepCount = widenRange ? Math.min(8, scored.length) : Math.min(5, scored.length);
  const top = scored.slice(0, keepCount).map((entry) => entry.len);
  const augmented = new Set(top);

  // Wiederholte Schlüssel heben oft die IoC-Werte ihrer Vielfachen an; wir behalten
  // darum plausible Teiler im Suchraum, damit die echte Periodenlänge nicht vorab wegfällt.
  const byLen = new Map(scored.map((entry) => [entry.len, entry]));
  for (const len of top) {
    for (let divisor = 2; divisor < len; divisor += 1) {
      if (len % divisor !== 0) {
        continue;
      }
      const divisorEntry = byLen.get(divisor);
      if (!divisorEntry) {
        continue;
      }
      if (divisorEntry.ioc >= 0.055) {
        augmented.add(divisor);
      }
    }
  }

  augmented.add(1);
  return Array.from(augmented).sort((a, b) => a - b);
}
```

- Warum genau diese Variante:
  - Minimaler Eingriff.
  - Fixiert direkt die Ursache.
  - Verändert keine Downstream-Heuristiken.
  - `ioc >= 0.055` hält nur Teiler, die bereits klar über Zufalls-/Mischtextniveau liegen; der Wert war in der Sandbox-Simulation für QUANT ausreichend und hat BRICK/PHASE nicht gestört.

## Tests und Abnahme
- Vor Implementierung erneut laufen lassen:
  - `./node_modules/.bin/vitest run tests/vitest/vigenere-regression.test.mjs tests/vitest/vigenere-strategy-and-budgets.test.mjs`
- Neue Regression in [tests/vitest/vigenere-regression.test.mjs](/home/mrphaot/Dokumente/Kryptografie-Projekt/tests/vitest/vigenere-regression.test.mjs) ergänzen:
  - plaintext: `EINSTEIN ... AUSGELOEST WERDEN`
  - key: `QUANT`
  - crack ohne Hint, `optimizations: true`
  - `ranked.bestCandidate.key === "QUANT"`
  - `compactLetters(ranked.bestCandidate.text) === compactLetters(plaintext)`
  - optional zusätzlich: `cracked.candidates.some((c) => c.keyLength === 5) === true`
- Bestehende Pflichtläufe müssen grün bleiben:
  - `./node_modules/.bin/vitest run tests/vitest/vigenere-regression.test.mjs`
  - `./node_modules/.bin/vitest run tests/vitest/vigenere-strategy-and-budgets.test.mjs`
- Bereits in Sandbox validiert:
  - aktuelle Suite: 15/15 grün
  - In-Memory-Patch-Simulation: QUANT unhinted grün, BRICK grün, kein Hinweis auf PHASE-Regressionsursache

## Annahmen und Defaults
- Kein zusätzlicher Fix an `localSearchK` oder Option-Budgets in diesem Schritt.
- Kein Doku-Update nötig, solange nur die interne Längenselektion korrigiert und eine Regression ergänzt wird.
- `pnpm` war im Sandbox-Pfad nicht verfügbar; lokale Verifikation lief über `./node_modules/.bin/vitest`.
