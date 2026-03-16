---
name: datenfluss
description: Laufzeit-Datenfluss von Eingabe bis Ausgabe inklusive Fallbacks und Kandidaten-Ranking.
---

# Laufzeit-Datenfluss

## Ziel
Diese Datei beschreibt den tatsÃ¤chlichen Laufzeitpfad in `js/app.js` und den beteiligten Core-Modulen.

## Ablauf

1. Initialisierung
- `app.js` lÃ¤dt `KryptoCore` und `KryptoCiphers`.
- `CipherRegistry` registriert alle gÃ¼ltigen Cipher.
- Dropdown und UI-ZustÃ¤nde werden initial gesetzt.
 

2. Eingabe
- Textquelle:
  - manuelle Eingabe im Textfeld
  - Datei-Upload
  - Drag-and-drop
- Datei wird Ã¼ber `parseInputFile(file)` gelesen und zu `inputText`.

3. Dateiparsing (`js/core/fileParsers.js`)
- Format nach Extension.
- UnterstÃ¼tzt: `txt`, `log`, `md`, `json`, `csv`, `js`, `mjs`, `cjs`, `xml`, `yaml`, `yml`.
- XML nutzt priorisierte Strict-Tags (`coded`, `ciphertext`, `cipher`, `text`, `message`, `payload`, `content`, `data`, `body`);
  Prefix-Tags wie `codedExport` matchen bewusst nicht als `coded`.
- XML ohne priorisierten Treffer fÃ¤llt auf Tag-Strip + Whitespace-Normalisierung zurÃ¼ck.
- YAML parst einen konservativen Browser-Subset (Mappings, Sequenzen, Block-Scalars) und nutzt danach dieselbe String-Extraktion wie JSON.
- YAML mit nicht getragenen Features (z. B. Anchors/Aliases) fÃ¤llt defensiv auf den Originaltext zurÃ¼ck.
- JS-Parser bewertet reine Literal-Fallback-Kandidaten neutral Ã¼ber den Pfad `_literal`,
  damit starke SchlÃ¼ssel wie `value` nur bei echten Key-Signalen aus Assignment/Property wirken.
- CSV-Textspaltenwahl nutzt exakte Header-Tokens (Delimiter: `_`, Leerzeichen, `-`) statt Substring-Matching;
  so werden False Positives wie `metadata` -> `data` vermieden, wÃ¤hrend `cipher_text` weiter erkannt wird.
- CSV ohne erkannte Textspalte nutzt weiterhin einen Zeilen-Fallback Ã¼ber alle Zellen.
- Vor dem Flatten prÃ¼ft eine konservative Header-Heuristik die erste Zeile.
- Die erste Zeile wird nur bei starkem Header-Signal entfernt; bei unklaren FÃ¤llen bleibt
  sie erhalten, damit headerlose Dateien keine erste Datenzeile verlieren.
- Unbekanntes Format: Fallback als Klartext (`fallback: true`).

4. AusfÃ¼hrung (`runCipher`)
- Validiert, ob Text vorhanden ist.
- Liest Modus (`encrypt`/`decrypt`) und gewÃ¤hlten Cipher.
- Optional: SchlÃ¼ssel-Parsing und Crack-Optionen.
 

5. VerschlÃ¼sseln
- `cipher.encrypt(text, key)` wird aufgerufen.
- Ergebnis landet in `outputText`.
- Kandidatenbereich wird ausgeblendet.

6. EntschlÃ¼sseln mit bekanntem SchlÃ¼ssel
- `cipher.decrypt(text, key)` wird aufgerufen.
- Ergebnis landet segmentiert in `outputText`; bei Rail Fence, Skytale, Columnar Transposition und Playfair wird zusÃ¤tzlich der Rohtext (ungegliedert) angezeigt.
- Kandidatenbereich wird ausgeblendet.

7. EntschlÃ¼sseln ohne SchlÃ¼ssel (Knacken)
- Bei VigenÃ¨re setzt die UI vor `cipher.crack(...)` den Hinweis:
  - `VigenÃ¨re: Bruteforce-PrÃ¼fung lÃ¤uft gegebenenfalls, bitte warten ...`
  - `runButton` wird deaktiviert
  - `requestAnimationFrame` wird einmal abgewartet, damit der Hinweis sichtbar ist
 
- `cipher.crack(text, options)` liefert besten Kandidaten und optional `candidates`.
- Bei Playfair ergÃ¤nzt `app.js` optional `dictionaryScorer.getKeyCandidates(...)` im
  `options`-Objekt, damit der Cipher eine deterministische Key-Shortlist fÃ¼r Phase B nutzen kann.
- Rail Fence nutzt im UI dasselbe Schienen-Feld fÃ¼r beides:
  - leer = knacken
  - Zahl = direkt entschlÃ¼sseln
- Skytale nutzt im UI dasselbe Umfang-Feld fÃ¼r beides:
  - leer = knacken
  - Zahl = direkt entschlÃ¼sseln
- Playfair nutzt zusÃ¤tzlich ``dictionaryScorer.analyzeTextQuality(...)`` fÃ¼r Ausgabe + Score;
  derselbe Pfad lÃ¤uft sowohl bei `decrypt(...)` mit bekanntem SchlÃ¼ssel als auch im Crack-Scoring.
- Playfair lÃ¤uft als Hybrid-Crack:
  - Phase A: feste Shortlist (inkl. `QUANT`, `FAC`)
  - Phase B: erweitertes Key-Corpus (Lexikon + PrÃ¤fix-/Stem-Varianten)
  - AmbiguitÃ¤ts-Gate triggert Phase B bei `low_confidence`, `low_delta` oder `low_coverage`
- VigenÃ¨re kann nach dem regulÃ¤ren Chi/Frequenzpfad in einen staged Bruteforce-Fallback (`[12,18,26]`) wechseln.
- Rail Fence darf lesbare Segmentierung (`displayText`) im Crack-Pfad nach oben reichen, wenn die Shared-Analyse klare Wortgrenzen stÃ¼tzt; `decrypt(...)` bleibt Rohtext-Inversion.
- Skytale bewertet Crack-Kandidaten via ``dictionaryScorer.analyzeTextQuality(...)``, gibt `displayText` aus und behÃ¤lt den gepaddeten `rawText`.
- Columnar Transposition testet Permutationen bis Länge 6 und bewertet eine Shortlist per `dictionaryScorer.analyzeTextQuality(...)`.
- Im UI-Pfad setzt `app.js` fÃ¼r VigenÃ¨re standardmÃ¤ÃŸig `optimizations: true`.
- Bei `keyLength`-Hint wird das Fallback-Budget direkt Ã¼ber `maxMsPerLength` begrenzt.
- Ohne `keyLength`-Hint wird der Fallback zusÃ¤tzlich Ã¼ber ein adaptives GrÃ¶ÃŸen-Gate begrenzt.
- Die konkrete Gate-/Sense-Logik liegt in `docs/SCORING.md`; hier bleibt nur der Laufzeitpfad dokumentiert.
- Kandidaten werden normalisiert und nach `confidence` sortiert.
- Optionales Reranking via `dictionaryScorer.rankCandidates(...)`.
- `rankCandidates(...)` nutzt dieselbe Shared-Textanalyse wie Playfair-Scoring.
- Bester Kandidat wird als Ausgabe gesetzt.
- FÃ¼r Rail Fence, Skytale, Columnar Transposition und Playfair wird zusÃ¤tzlich der Rohtext aus `rawText` angezeigt.

8. Status und Hinweise
- Bei geringer WÃ¶rterbuchabdeckung zeigt die UI Hinweise.
- Bei VigenÃ¨re + kurzem Text wird ein ZuverlÃ¤ssigkeits-Hinweis ergÃ¤nzt.
- API-VerfÃ¼gbarkeit beeinflusst den Kandidatenstatus-Text.
- Nach dem Crack wird `runButton` wieder aktiviert.
- Falls Fallback lief, kann der Endstatus Bruteforce-Info enthalten.
- Fallback-Telemetrie wird defensiv formatiert, damit keine `NaN`/`undefined`-Werte im Status erscheinen.

9. Kopieren
- PrimÃ¤r `navigator.clipboard.writeText(...)`.
- Fallback: `document.execCommand("copy")`.

## Fehler- und Fallback-Verhalten

1. Parsingfehler
- Datei kann nicht gelesen oder geparst werden: Statusmeldung mit Fehlermeldung.

2. UngÃ¼ltige Eingaben
- Kein Text, ungÃ¼ltiger Cipher, ungÃ¼ltige SchlÃ¼ssellÃ¤nge: nutzernahe Fehlermeldung.

3. WÃ¶rterbuch-API nicht verfÃ¼gbar
- Kein Abbruch.
- Lokales Scoring bleibt aktiv, `apiAvailable = false`.
- API-VerfÃ¼gbarkeit folgt Reachability-/Wortcheck-Ergebnissen und nicht nur der Existenz von `fetch`.

4. Fehlender Dictionary-Scorer
- Kandidaten bleiben in lokalem Cipher-Ranking.

5. Bruteforce-Telemetrie (`result.search`)
- `bruteforceFallbackTriggered`
- `bruteforceFallbackReason`
- `bruteforceFallbackKeyLength`
- `bruteforceCombosVisited`
- `bruteforceElapsedMs`
- `sense`
- Playfair-Telemetrie ergÃ¤nzt:
  - `phase` (`A` oder `B`)
  - `fallbackTriggered`
  - `fallbackReasons`
  - `gate` (inkl. `minConfidence`, `minDelta`, `minCoverage`)
 

## Ergebnisgarantie auf UI-Ebene

- Jeder erfolgreiche Lauf setzt eine Ausgabe in `outputText`.
- Kandidatenliste erscheint nur bei mehreren Kandidaten.
- Statuszeile erlÃ¤utert den tatsÃ¤chlich gewÃ¤hlten Pfad.


