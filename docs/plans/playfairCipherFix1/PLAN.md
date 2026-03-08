# Hand-Off Plan: Allgemeiner Playfair-Fix über Hybrid-Segmentierung und robustes Sprachscoring

## Zusammenfassung
- Die aktuelle Schwäche ist allgemein und sitzt primär in `segmentText(...)`, nicht in der Playfair-Transformation und auch nicht im Key-Suchraum.
- Experimentell bestätigt:
  - `QUANT` entschlüsselt `GPOASZATEFEKMKKD` roh korrekt zu `IMPULSUNDENERGIE`, verliert aber wegen falscher Segmentierung zu `IMPULS UNDENE RGIE`.
  - Die aktuelle Logik überbewertet kurze Zufallstreffer wie `IHR`, `ONE`, `ARE` und generische Trim-/Prefix-Treffer wie `TEXTELH -> TEXT` oder `UNDENE -> UND`.
  - Pure Heuristik-Prototypen auf Basis des kleinen aktuellen Lexikons waren instabil und produzierten Fehlsegmente wie `IM | ... | DEN | ER`.
  - Eine große Offline-Wortbasis aus `de_DE.dic`/`american-english` segmentiert die bekannten Fälle sofort korrekt, ist aber ohne Caching viel zu teuer: in der Sandbox ca. `18105 ms` für nur `15` Segmentierungen mit `120000` Extra-Wörtern gegenüber `269 ms` für `300` Baseline-Segmentierungen.
  - Reine Datenlösung ist trotzdem nicht genug: OOV-Fälle werden teilweise nur zufällig über die aktuelle zu großzügige Stem-/Prefix-Logik „gerettet“ und zeigen weiter Fehlsegmente wie `KOH ARENZ FELD`.
- Daraus folgt: Der beste langfristige Fix ist ein Hybridverfahren.
  - Offline-Sprachbestand für robuste Exact-Matches und allgemeine Standardsprache.
  - Strengere Heuristiken gegen Short-Word-/Stem-Overmatching.
  - Kompaktes Subword-/Unknown-Word-Modell für echte OOV-Wörter.

## Implementierungsänderungen
### 1. Sprachbasis in `dictionaryScorer` auf Hybridmodell umstellen
- Neue Datei [js/core/segmentLexiconData.js](/home/mrphaot/Dokumente/Kryptografie-Projekt/js/core/segmentLexiconData.js) einführen und in `index.html` vor [js/core/dictionaryScorer.js](/home/mrphaot/Dokumente/Kryptografie-Projekt/js/core/dictionaryScorer.js) laden.
- Diese Datei enthält repo-intern und deterministisch:
  - eine normalisierte Exact-Lexikonbasis aus `de_DE.dic` + `american-english`
  - ein kompaktes Trigramm-Modell, aus derselben Basis vorab generiert
- Keine großen Runtime-Arrays per `extraWords` pro Aufruf durchreichen. Das wurde experimentell als zu langsam belegt.
- Optional zusätzlich ein Node-Skript zum regenerieren des Artifacts anlegen, z. B. `scripts/segment/build_segment_lexicon_model.mjs`, aber das generierte Artifact wird eingecheckt.

### 2. `segmentText(...)` algorithmisch umbauen
- Öffentliche Rückgabefelder stabil halten:
  - `text`
  - `tokens`
  - `coverage`
  - `meaningfulTokenRatio`
  - `unknownRatio`
  - `confidence`
- Intern die Segmentierung auf drei Tokenklassen stützen:
  - `exact`: exakte Wörter aus der Offline-Basis oder den bestehenden Domain-/Cipher-Extras
  - `suffix_variant`: nur noch mit harter Suffix-Whitelist statt beliebigem `trim 1..3`
  - `unknown_word`: OOV-Chunks mit positivem Word-Shape-/Trigramm-Score
- Die bisherige generische Prefix-Logik nicht mehr als primären Segmentpfad verwenden. Sie ist die Hauptursache für Fehlgriffe wie `TEXTELH` und `UNDENE`.
- Stem-/Suffix-Regeln konkret einschränken:
  - nur erlaubte Endungen wie `e`, `en`, `er`, `es`, `n`, `s`, `em`, `ern`, `ing`, `ed`
  - Basiswort muss mindestens 4 Buchstaben haben
  - kurze Funktionswörter wie `und`, `are`, `one`, `ihr`, `im`, `den`, `er` dürfen nicht über diese Variante künstlich aufgewertet werden
- Unknown-Word-Modell konkret ergänzen:
  - Trigramm-Likelihood aus dem vorab generierten Sprachmodell
  - Vokalverhältnis
  - häufige Bigramme
  - Konsonantenlauf-Penalty
  - Wortlängen-Prior
- Für lange unbekannte Runs eine zweite Split-Phase ergänzen:
  - zerlegt unbekannte Reststücke in bis zu 3 OOV-Wörter
  - maximiert Unknown-Word-Plausibilität minus Split-Penalty
  - erlaubt kurze Bridge-Wörter (`und`, `the`, `are`, `one`, `ihr` etc.) nur dann, wenn links und rechts starke oder plausible Nachbarsegmente liegen
- `meaningfulTokenRatio` neu als buchstaben-gewichtete Kennzahl berechnen, nicht mehr token-count-basiert. Das verhindert, dass ein einzelnes kurzes Wort wie `IHR` sofort `0.5` Sinnhaftigkeit erzeugt.

### 3. Playfair-Scoring an die neuen Segmentmetriken binden
- In [js/ciphers/playfairCipher.js](/home/mrphaot/Dokumente/Kryptografie-Projekt/js/ciphers/playfairCipher.js) die bestehende Confidence-Formel strukturell beibehalten, aber die Segmentmetriken aus dem neuen `segmentText(...)` verwenden.
- Zielverhalten:
  - plausible OOV-Wörter dürfen positiv zum Score beitragen
  - kurze isolierte Stopwords dürfen keinen Kandidaten mehr dominieren
  - Bigramm-/Vokal-Signale bleiben nur sekundäre Tie-Breaker
- `PLAYFAIR_SEGMENT_WORDS` beibehalten, aber nur noch als zusätzliche Domain-Hints behandeln, nicht mehr als primären Fixmechanismus.

### 4. Daten- gegen Heuristikpfad explizit trennen
- Exact-Lexikon aus Offline-Daten ist die erste Stufe.
- Unknown-Word-Heuristik ist die zweite Stufe für OOV-Wörter wie `FOTONEN` oder `KOHARENZ`.
- Hybrid-Regel:
  - exakte Wörter schlagen OOV-Heuristik
  - OOV-Heuristik schlägt rohe Zeichenmüll-Segmente
  - kurze Bridge-Wörter zählen nur mit Nachbarstütze

## Testplan
- Bestehende Playfair-Regressionen und 1k-Test beibehalten.
- In [tests/vitest/playfair-regression.test.mjs](/home/mrphaot/Dokumente/Kryptografie-Projekt/tests/vitest/playfair-regression.test.mjs) ergänzen:
  - `decrypt("GPOASZATEFEKMKKD", "QUANT") === "IMPULS UND ENERGIE"`
  - `crack("GPOASZATEFEKMKKD", { keyCandidates })` liefert `QUANT`, `IMPULS UND ENERGIE`, `phase === "A"`, `fallbackTriggered === false`
  - direkter Segmentierungstest:
    - `segmentText("IMPULSUNDENERGIE") === "IMPULS UND ENERGIE"`
    - `segmentText("FOTONENFELD") === "FOTONEN FELD"`
    - `segmentText("FOTONENSIGNAL") === "FOTONEN SIGNAL"`
    - `segmentText("KOHARENZFELD") === "KOHARENZ FELD"`
  - Negativschutz gegen Short-Word-Overmatching:
    - `CUDTUYTRCERELIHR` darf nicht mehr wegen `IHR` höher bewertet werden als `IMPULS UND ENERGIE`
- In [tests/vitest/generators/playfairDataset.js](/home/mrphaot/Dokumente/Kryptografie-Projekt/tests/vitest/generators/playfairDataset.js) fixe Pflichtfälle erweitern:
  - `QUANT | FOTONEN FELD`
  - `QUANT | FOTONEN SIGNAL`
  - `QUANT | IMPULS UND ENERGIE`
  - `QUANT | KOHARENZ FELD`
- In [tests/vitest/playfair-keyless-e2e-1k.test.mjs](/home/mrphaot/Dokumente/Kryptografie-Projekt/tests/vitest/playfair-keyless-e2e-1k.test.mjs) zusätzlich prüfen, dass diese Pflichtfälle enthalten sind.
- Ausführen:
  - `node --check js/core/segmentLexiconData.js`
  - `node --check js/core/dictionaryScorer.js`
  - `node --check js/ciphers/playfairCipher.js`
  - `node --check tests/vitest/playfair-regression.test.mjs`
  - `node --check tests/vitest/generators/playfairDataset.js`
  - `node --check tests/vitest/playfair-keyless-e2e-1k.test.mjs`
  - `./node_modules/.bin/vitest run tests/vitest/playfair-regression.test.mjs tests/vitest/playfair-keyless-e2e-1k.test.mjs`
  - `./node_modules/.bin/vitest run tests/vitest/*.test.mjs`

## Faktenbasierte Empfehlung
- Pure Heuristik ist langfristig möglich, war in den Sandbox-Prototypen aber deutlich instabiler als der datenbasierte Pfad.
- Pure Offline-Wortliste ist deutlich verlässlicher für Standardsprache, aber ohne zusätzliche Heuristik nicht zukunftssicher genug für OOV-Wörter und ohne Caching zu langsam.
- Das beste Verhältnis aus Verlässlichkeit, Zukunftssicherheit und Laufzeit ist daher:
  - gecachter eingebetteter Offline-Sprachbestand
  - plus kompakte OOV-Heuristik
  - plus harte Regeln gegen Short-Word-/Stem-Overmatching

## Annahmen
- Eine zusätzliche repo-interne Daten-/Modell-Datei ist erlaubt, solange keine große externe Dependency eingeführt wird.
- Die Datenquelle wird nur zur Generierung des eingecheckten Artifacts genutzt; die Browser-Laufzeit bleibt vollständig lokal und deterministisch.
- `pnpm` ist in dieser Sandbox nicht im `PATH`; Tests direkt über `./node_modules/.bin/vitest`.
