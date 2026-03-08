---
name: sprachscoring-und-kandidatenbewertung
description: Lokales Sprachscoring in den Ciphers und optionales Wörterbuch-Reranking in js/core/dictionaryScorer.js.
---

# Scoring- und Kandidatenbewertung

## Ziel
Diese Datei beschreibt, wie Kandidaten für das Knacken bewertet, sortiert und im UI dargestellt werden.

## 1) Lokales Sprach-Scoring in den Ciphers

1. Cäsar (`caesarCipher.js`)
- Bewertet Kandidaten über:
  - häufige Wörter (DE/EN)
  - Bigramme/Trigramme
  - Buchstabenverteilung (Chi-Quadrat)
  - Vokal- und Leerzeichenverhältnis
- `crack(...)` testet alle 26 Schlüssel und liefert Top-Kandidaten.

2. Vigenère (`vigenereCipher.js`)
- Nutzt:
  - Schlüssellängen-Kandidaten (IoC-basiert)
  - Spaltenweise Shift-Rangfolge (Chi-Quadrat)
  - budgetierte Kandidatensuche
  - Kurztext-Rettungsmodus
  - lokale Verfeinerung per Search
  - Sprach-Scoring auf Kandidatentext
- Optionaler `keyLength`-Hint erhöht Präzision und reduziert Suchraum.
- Der `keyLength`-Hint wird vor der Suche einmal auf die testbare Buchstabenlänge
  (`extractLettersUpper(text).length`) begrenzt.
- Diese effektive (geclampte) Länge wird konsistent für Schlüssellängen-Kandidaten,
  Divisor-Erweiterung und Hint-basiertes Fallback-Gating verwendet.
- Dadurch öffnen übergroße Hints keinen größeren Suchraum als tatsächlich testbar.
- Bei kurzen und sinnarmen Kandidaten kann ein staged Bruteforce-Fallback laufen:
  - Stage 1: Top-12 je Spalte
  - Stage 2: Top-18 je Spalte
  - Stage 3: Top-26 je Spalte
- Fallback läuft ausschließlich über das AND-Gate:
  - Text ist kurz
  - Kandidat ist sinnarm (Sense-Gate)
  - Schlüssellänge liegt innerhalb `maxKeyLength`
- Wenn der Text nicht kurz ist, bleibt der Pfad bei Frequenz-/Chi-Analyse und
  `bruteforceFallbackReason` wird als `text_not_short` ausgewiesen.
- Mit `keyLength`-Hint gilt für den Fallback direkt:
  - `maxElapsedMs = min(remainingTotalMs, maxMsPerLength)`
- Ohne `keyLength`-Hint bleibt dieser Fallback auf adaptiv günstige Kurzfälle begrenzt
  (`maxMsPerLength`), damit Laufzeitbudgets stabil bleiben.
- Der Chi-Memo-Cache ist hart begrenzt (`MAX_CHI_MEMO_CACHE_SIZE`) und wird pro
  Crack-Session explizit zurückgesetzt, damit kein Session-Leak entsteht.
- Sense-Metriken (`evaluateSenseMetrics(text)`):
  - `dictCoverageProxy`
  - `meaningfulTokenRatio`
  - `nonsenseRatio = 1 - meaningfulTokenRatio`
  - `gibberishBigramRatio`
  - `senseScore = 0.50*dictCoverageProxy + 0.35*meaningfulTokenRatio + 0.15*(1-gibberishBigramRatio)`
- Fallback-Kandidatenscore:
  - `scoreLanguage`
  - `+ dictionaryBoostScore`
  - `+ senseBonus` (aus `senseScore` + `meaningfulTokenRatio`)
- Merge-Regel: Fallback ersetzt Basiskandidat nur bei klarer Qualitätsverbesserung.

3. Playfair (`playfairCipher.js`)
- Didaktische Normalisierung:
  - `J -> I`
  - nur `A-Z`
  - Bigramme mit `X`-Filler bei Doppelzeichen
  - `X`-Padding bei ungerader Länge
- Entschlüsselung nutzt Postprocessing:
  - `removeDidacticPadding` entfernt didaktische `X`-Einfügungen (`A X A`) und optionales End-`X`
  - Segmentierung/Qualitätsanalyse läuft über `dictionaryScorer.analyzeTextQuality(...)`, damit Decrypt- und Crack-Ausgabe identisch getrennt werden
  - Dafür wird vor `dictionaryScorer.js` das Offline-Sprachartifact `segmentLexiconData.js` geladen
  - `PLAYFAIR_SEGMENT_WORDS` bleiben getrennt vom Phase-B-Keykorpus und dienen nur als zusätzliche Domain-Hints
- Hybrid-Crack:
  - Phase A: deterministische Key-Shortlist (inkl. `QUANT`)
  - Phase B: erweitertes Key-Corpus aus Lexikonbegriffen + Präfix-/Stem-Varianten
- Candidate-Scoring gewichtet primär robuste Segmentierungsmetriken:
  - `qualityScore` aus der Shared-Analyse als primärer Kandidatenscore
  - `confidence`, `coverage`, `meaningfulTokenRatio`, `strongSegmentRatio`
  - Boundary-Risiken (`weakBoundaryCount`, `unsupportedBridgeCount`, `shortTokenCount`)
- Ambiguitäts-Gate (Default):
  - `minConfidence = 11.2`
  - `minDelta = 1.8`
  - `minCoverage = 0.62`
- Fallback-Trigger, wenn mindestens eine Bedingung erfüllt ist:
  - `top1.confidence < minConfidence`
  - `(top1.confidence - top2.confidence) < minDelta`
  - `coverage(top1) < minCoverage`

4. Leetspeak (`leetCipher.js`)
- Beam-Search für Rückübersetzungen.
- Übergangs-Scoring während der Sequenzbildung.
- Sprach-Scoring auf erzeugtem Klartext.
- Liefert primär den besten Kandidaten.

## 2) Kandidatenfluss in `app.js`

1. `crack(...)`-Ergebnis wird normalisiert:
- Mindestfelder: `key`, `text`, `confidence`
- optional: `candidates`
- Für Playfair kann `app.js` optional `keyCandidates` aus
  `dictionaryScorer.getKeyCandidates(...)` vor dem Crack ergänzen.

2. Lokale Sortierung:
- Absteigend nach `confidence`.

3. Optionales Wörterbuch-Reranking:
- `dictionaryScorer.rankCandidates(candidates, { languageHints: ["de", "en"] })`

4. Ergebnisübernahme:
- `bestCandidate` wird in die Ausgabe geschrieben.
- Top-Kandidaten werden im Kandidatenbereich angezeigt.

## 3) Wörterbuch-Reranking (`js/core/dictionaryScorer.js`)

1. Tokenisierung
- Extrahiert Wörter aus Kandidatentexten.
- Normalisiert (u. a. Kleinbuchstaben, `ß -> ss`).
- Dedupliziert und begrenzt die Wortanzahl pro Kandidat.

2. Validierung
- API-Prüfung über `dictionaryapi.dev` je Sprache (`de`, `en`) mit Timeout.
- Reachability-Probe läuft über alle `languageHints` (Fallback `en`) statt nur über den ersten Eintrag.
- Lokales Lexikon als Fallback und Ergänzung.
- Cache auf Wort-/Sprachpaar-Ebene.

3. Kombinierter Score
- Basis für API-Rescoring: `base = Number(candidate.rawConfidence) || 0`
- Shared-Analyse (`analyzeTextQuality`) je Kandidat:
  - `qualityScore` als Zusatzsignal
  - Boundary-/Kurztoken-Mali
- Wörterbuch-Anteil:
  - `dictBoost = coverage * 20 + validWords * 1.2`
- Malus:
  - `zeroPenalty = -3.2`, wenn mindestens 2 Wörter geprüft und 0 erkannt
- Gesamtscore:
  - Basisterm: `combinedScore = base * 0.35 + dictBoost + zeroPenalty`
  - erweitert um Language-Bonus, `qualityScore` und Boundary-Penalty

4. Sortierung
- Primär nach `combinedScore` absteigend.
- Tie-Breaker: ursprüngliche Reihenfolge (`rankIndex`).

5. Optionale Key-Kandidaten für Ciphers
- `getKeyCandidates(options)` liefert deterministische Schlüsselvorschläge (z. B. für Playfair-Phase B).
- Quellen:
  - gemeinsame Seeds + sprachspezifische Seeds (`languageHints`)
  - optionale `seedWords`
  - Text-Token aus `options.text`
  - lokales Lexikon je Sprache
- Jede Quelle wird mit Präfix-/Stem-Varianten erweitert, damit Key-Korpora robust bleiben,
  ohne eine teure Vollraumsuche starten zu müssen.

6. Shared-Textsegmentierung
- Zentrale Funktion: `analyzeTextQuality(text, options?)` liefert:
  - `rawText`, `displayText`, `displayTokens`, `scoreTokens`
  - `coverage`, `meaningfulTokenRatio`, `unknownRatio`, `confidence`, `qualityScore`
  - `averageTokenScore`, `plausibleOovRatio`, `supportedBridgeRatio`, `strongSegmentRatio`, `lexiconCoverage`
  - `boundaryCount`, `weakBoundaryCount`, `unsupportedBridgeCount`, `shortTokenCount`
- `segmentText(text, options?)` bleibt API-kompatibel und spiegelt intern `analyzeTextQuality(...)`:
  - `segmentText(...).text === displayText`
  - `segmentText(...).tokens === displayTokens`
- Die Segmentierung nutzt DP auf zusammenhängenden `A-Z`-Runs mit:
  - Exact-Matches aus `segmentLexiconData.js` (normalisierte Wörter aus `de_DE.dic` + `american-english`)
  - harter Suffix-Whitelist statt generischem Trim-1..3-Stemming
  - OOV-Wortmodell aus Trigramm-Likelihood, Vokalverhältnis, Bigrammratio, Konsonantenlauf und Wortlängen-Prior
  - lokaler Re-Split-Phase für lange unbekannte Runs in bis zu 3 plausible Wörter
  - Boundary-Qualität statt Split-Quantität (Boundary-Kosten, Short-Token-Skepsis, Bridge-Nachbarschaftsprüfung)
- Generische Prefix-Matches sind bewusst kein primärer Segmentpfad mehr, weil sie Fehlgriffe wie `TEXTELH -> TEXT` oder `UNDENE -> UND` systematisch überbewerten.
- `rankCandidates(...)` nutzt dieselbe Shared-Analyse wie Playfair, damit lokales Kandidatenranking und Playfair-Scoring konsistent bleiben.

## 4) UI-Darstellung

1. Kandidatenliste
- Zeigt Schlüssel (wenn vorhanden), Score und ggf. Wörterbuchabdeckung.
 
2. Statusmeldungen
- API verfügbar: Hinweis auf API-Nachbewertung.
- API nicht verfügbar: Hinweis auf lokales Scoring.
- 0% Abdeckung: zusätzlicher Hinweis.
- Bei aktivem Bruteforce-Fallback kann der Endstatus Dauer + Kombinationsanzahl anzeigen.

## 5) Grenzen und Nebenwirkungen

- Wörterbuch-Reranking kann lokales Cipher-Ranking bewusst überstimmen.
- Sehr kurze Texte bleiben trotz Heuristiken unsicher (besonders Vigenère).
- API-Ausfälle dürfen Funktionalität nicht blockieren.

## 6) Parser-Vorpriorisierung (Dateiimport)

- Bei JS-Importen werden Kandidaten weiterhin über Key-Pfade gewichtet; reine Literal-Fallbacks bleiben neutral (`_literal`).
- Bei CSV-Importen erfolgt die Erkennung der Textspalte über exakte Header-Tokens statt über Teilwort-Treffer.
- Diese Vorpriorisierung betrifft nur die Textextraktion aus Dateien und ändert nicht das Cipher- oder Wörterbuch-Scoring.
