---
name: sprachscoring-und-kandidatenbewertung
description: Lokales Sprachscoring in den Ciphers und optionales WÃ¶rterbuch-Reranking in js/core/dictionaryScorer.js.
---

# Scoring- und Kandidatenbewertung

## Ziel
Diese Datei beschreibt, wie Kandidaten fÃ¼r das Knacken bewertet, sortiert und im UI dargestellt werden.

## 1) Lokales Sprach-Scoring in den Ciphers

1. CÃ¤sar (`caesarCipher.js`)
- Bewertet Kandidaten Ã¼ber:
  - hÃ¤ufige WÃ¶rter (DE/EN)
  - Bigramme/Trigramme
  - Buchstabenverteilung (Chi-Quadrat)
  - Vokal- und LeerzeichenverhÃ¤ltnis
- `crack(...)` testet alle 26 SchlÃ¼ssel und liefert Top-Kandidaten.

2. VigenÃ¨re (`vigenereCipher.js`)
- Nutzt:
  - SchlÃ¼ssellÃ¤ngen-Kandidaten (IoC-basiert)
  - Spaltenweise Shift-Rangfolge (Chi-Quadrat)
  - budgetierte Kandidatensuche
  - Kurztext-Rettungsmodus
  - lokale Verfeinerung per Search
  - Sprach-Scoring auf Kandidatentext
- Optionaler `keyLength`-Hint erhÃ¶ht PrÃ¤zision und reduziert Suchraum.
- Der `keyLength`-Hint wird vor der Suche einmal auf die testbare BuchstabenlÃ¤nge
  (`extractLettersUpper(text).length`) begrenzt.
- Diese effektive (geclampte) LÃ¤nge wird konsistent fÃ¼r SchlÃ¼ssellÃ¤ngen-Kandidaten,
  Divisor-Erweiterung und Hint-basiertes Fallback-Gating verwendet.
- Dadurch Ã¶ffnen Ã¼bergroÃŸe Hints keinen grÃ¶ÃŸeren Suchraum als tatsÃ¤chlich testbar.
- Bei kurzen und sinnarmen Kandidaten kann ein staged Bruteforce-Fallback laufen:
  - Stage 1: Top-12 je Spalte
  - Stage 2: Top-18 je Spalte
  - Stage 3: Top-26 je Spalte
- Fallback lÃ¤uft ausschlieÃŸlich Ã¼ber das AND-Gate:
  - Text ist kurz
  - Kandidat ist sinnarm (Sense-Gate)
  - SchlÃ¼ssellÃ¤nge liegt innerhalb `maxKeyLength`
- Wenn der Text nicht kurz ist, bleibt der Pfad bei Frequenz-/Chi-Analyse und
  `bruteforceFallbackReason` wird als `text_not_short` ausgewiesen.
- Mit `keyLength`-Hint gilt fÃ¼r den Fallback direkt:
  - `maxElapsedMs = min(remainingTotalMs, maxMsPerLength)`
- Ohne `keyLength`-Hint bleibt dieser Fallback auf adaptiv gÃ¼nstige KurzfÃ¤lle begrenzt
  (`maxMsPerLength`), damit Laufzeitbudgets stabil bleiben.
- Der Chi-Memo-Cache ist hart begrenzt (`MAX_CHI_MEMO_CACHE_SIZE`) und wird pro
  Crack-Session explizit zurÃ¼ckgesetzt, damit kein Session-Leak entsteht.
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
- Merge-Regel: Fallback ersetzt Basiskandidat nur bei klarer QualitÃ¤tsverbesserung.

3. Playfair (`playfairCipher.js`)
- Didaktische Normalisierung:
  - `J -> I`
  - nur `A-Z`
  - Bigramme mit `X`-Filler bei Doppelzeichen
  - `X`-Padding bei ungerader LÃ¤nge
- EntschlÃ¼sselung nutzt Postprocessing:
  - `removeDidacticPadding` entfernt didaktische `X`-EinfÃ¼gungen (`A X A`) und optionales End-`X`
  - Segmentierung/QualitÃ¤tsanalyse lÃ¤uft Ã¼ber `dictionaryScorer.analyzeTextQuality(...)`, damit Decrypt- und Crack-Ausgabe identisch getrennt werden
  - DafÃ¼r wird vor `dictionaryScorer.js` das Offline-Sprachartifact `segmentLexiconData.js` geladen
  - `PLAYFAIR_SEGMENT_WORDS` bleiben getrennt vom Phase-B-Keykorpus und dienen nur als zusÃ¤tzliche Domain-Hints
- Hybrid-Crack:
  - Phase A: deterministische Key-Shortlist (inkl. `QUANT`, `FAC`)
  - Phase B: erweitertes Key-Corpus aus Lexikonbegriffen + PrÃ¤fix-/Stem-Varianten
- Candidate-Scoring gewichtet primÃ¤r robuste Segmentierungsmetriken:
  - `qualityScore` aus der Shared-Analyse als primÃ¤rer Kandidatenscore
  - `confidence`, `coverage`, `meaningfulTokenRatio`, `strongSegmentRatio`
  - Boundary-Risiken (`weakBoundaryCount`, `unsupportedBridgeCount`, `shortTokenCount`)
- AmbiguitÃ¤ts-Gate (Default):
  - `minConfidence = 11.2`
  - `minDelta = 1.8`
  - `minCoverage = 0.62`
- Fallback-Trigger, wenn mindestens eine Bedingung erfÃ¼llt ist:
  - `top1.confidence < minConfidence`
  - `(top1.confidence - top2.confidence) < minDelta`
  - `coverage(top1) < minCoverage`
- FÃ¼r die UI wird zusÃ¤tzlich der Rohtext inklusive Padding-`X` bereitgestellt.

4. Leetspeak (`leetCipher.js`)
- Beam-Search fÃ¼r RÃ¼ckÃ¼bersetzungen.
- Ãœbergangs-Scoring wÃ¤hrend der Sequenzbildung.
- Sprach-Scoring auf erzeugtem Klartext.
- Liefert primÃ¤r den besten Kandidaten.

5. Rail Fence (`railFenceCipher.js`)
- SchlÃ¼sselbasiert (`supportsKey: true`), SchlÃ¼ssel ist die Schienenanzahl als ganze Zahl `>= 2`.
- Im UI nutzt Rail Fence dasselbe Feld als EntschlÃ¼sselungswert oder als Trigger fÃ¼r den Crack-Pfad.
- Ver- und EntschlÃ¼sselung laufen Ã¼ber den kompletten Zeichenstrom, nicht nur Ã¼ber Buchstaben.
- `crack(...)` interpretiert `options.keyLength` als Schienen-Hint.
- Ohne Hint testet Rail Fence exakt `2..min(12, text.length - 1)`.
- Mit `dictionaryScorer.analyzeTextQuality(...)` gilt:
  - `score = qualityScore + coverage * 10 + meaningfulTokenRatio * 8 + max(0, 1 - abs(spaceRatio - 0.16) * 4) - (rails / maxRails) * 0.35`
- Tie-Breaker: kleinere Rail-Anzahl zuerst.
- Ohne Dictionary-Scorer greift ein lokales Fallback aus hÃ¤ufigen WÃ¶rtern, Bigrammen/Trigrammen und Leerzeichen-Bonus.
- `displayText` wird nur im Crack-Pfad als Ausgabe genutzt; `decrypt(...)` liefert Rohtext, auch wenn Segmentierung mÃ¶glich wÃ¤re.
- Im UI wird beim EntschlÃ¼sseln der Rohtext segmentiert angezeigt; der Rohtext bleibt separat sichtbar.

6. Skytale (`scytaleCipher.js`)
- Normalisiert auf `A-Z`, padde mit `X` bis zum nÃ¤chsten Vielfachen des Umfangs.
- Crack-Range: ohne Hint `2..min(12, letters.length)`, mit Hint exakt diese Zahl.
- Scoring nutzt `dictionaryScorer.analyzeTextQuality(...)` und liefert:
  - `qualityScore` als primÃ¤ren Kandidatenscore
  - `displayText` fÃ¼r die lesbare Segmentierung
  - `rawText` als gepaddeten Rohtext
- Scoring trimmt End-`X`, bewertet bei geringer Coverage `displayText` erneut und penalisiert interne `X`-HÃ¤ufungen; Domain-WÃ¶rter erhalten einen Bonus.

7. Columnar Transposition (`columnarTranspositionCipher.js`)
- Normalisiert auf `A-Z` und padde mit `X` bis zum nächsten Vielfachen der Spaltenanzahl.
- Crack-Range: ohne Hint `2..min(6, letters.length)`, mit `keyLength` exakt diese Länge.
- Fallback-Score nutzt Bigramme/Trigramme, Domain-Wort-Bonus und eine Penalty für interne `X`-Häufungen.
- Shortlist-Rescoring über `dictionaryScorer.analyzeTextQuality(...)` liefert `displayText` und behält `rawText` (inkl. Padding).
## 2) Kandidatenfluss in `app.js`

1. `crack(...)`-Ergebnis wird normalisiert:
- Mindestfelder: `key`, `text`, `confidence`
- optional: `candidates`
- FÃ¼r Playfair kann `app.js` optional `keyCandidates` aus
  `dictionaryScorer.getKeyCandidates(...)` vor dem Crack ergÃ¤nzen.

2. Lokale Sortierung:
- Absteigend nach `confidence`.

3. Optionales WÃ¶rterbuch-Reranking:
- `dictionaryScorer.rankCandidates(candidates, { languageHints: ["de", "en"] })`

4. ErgebnisÃ¼bernahme:
- `bestCandidate` wird in die Ausgabe geschrieben.
- Top-Kandidaten werden im Kandidatenbereich angezeigt.

## 3) WÃ¶rterbuch-Reranking (`js/core/dictionaryScorer.js`)

1. Tokenisierung
- Extrahiert WÃ¶rter aus Kandidatentexten.
- Normalisiert (u. a. Kleinbuchstaben, `ÃŸ -> ss`).
- Dedupliziert und begrenzt die Wortanzahl pro Kandidat.

2. Validierung
- API-PrÃ¼fung Ã¼ber `dictionaryapi.dev` je Sprache (`de`, `en`) mit Timeout.
- Reachability-Probe lÃ¤uft Ã¼ber alle `languageHints` (Fallback `en`) statt nur Ã¼ber den ersten Eintrag.
- Lokales Lexikon als Fallback und ErgÃ¤nzung.
- Cache auf Wort-/Sprachpaar-Ebene.

3. Kombinierter Score
- Basis fÃ¼r API-Rescoring: `base = Number(candidate.rawConfidence) || 0`
- Shared-Analyse (`analyzeTextQuality`) je Kandidat:
  - `qualityScore` als Zusatzsignal
  - Boundary-/Kurztoken-Mali
- WÃ¶rterbuch-Anteil:
  - `dictBoost = coverage * 20 + validWords * 1.2`
- Malus:
  - `zeroPenalty = -3.2`, wenn mindestens 2 WÃ¶rter geprÃ¼ft und 0 erkannt
- Gesamtscore:
  - Basisterm: `combinedScore = base * 0.35 + dictBoost + zeroPenalty`
  - erweitert um Language-Bonus, `qualityScore` und Boundary-Penalty

4. Sortierung
- PrimÃ¤r nach `combinedScore` absteigend.
- Tie-Breaker: ursprÃ¼ngliche Reihenfolge (`rankIndex`).

5. Optionale Key-Kandidaten fÃ¼r Ciphers
- `getKeyCandidates(options)` liefert deterministische SchlÃ¼sselvorschlÃ¤ge (z. B. fÃ¼r Playfair-Phase B).
- Quellen:
  - gemeinsame Seeds + sprachspezifische Seeds (`languageHints`)
  - optionale `seedWords`
  - Text-Token aus `options.text`
  - lokales Lexikon je Sprache
- Jede Quelle wird mit PrÃ¤fix-/Stem-Varianten erweitert, damit Key-Korpora robust bleiben,
  ohne eine teure Vollraumsuche starten zu mÃ¼ssen.

6. Shared-Textsegmentierung
- Zentrale Funktion: `analyzeTextQuality(text, options?)` liefert:
  - `rawText`, `displayText`, `displayTokens`, `scoreTokens`
  - `coverage`, `meaningfulTokenRatio`, `unknownRatio`, `confidence`, `qualityScore`
  - `averageTokenScore`, `plausibleOovRatio`, `supportedBridgeRatio`, `strongSegmentRatio`, `lexiconCoverage`
  - `boundaryCount`, `weakBoundaryCount`, `unsupportedBridgeCount`, `shortTokenCount`
- `segmentText(text, options?)` bleibt API-kompatibel und spiegelt intern `analyzeTextQuality(...)`:
  - `segmentText(...).text === displayText`
  - `segmentText(...).tokens === displayTokens`
- Die Segmentierung nutzt DP auf zusammenhÃ¤ngenden `A-Z`-Runs mit:
  - Exact-Matches aus `segmentLexiconData.js` (normalisierte WÃ¶rter aus `de_DE.dic` + `american-english`)
  - harter Suffix-Whitelist statt generischem Trim-1..3-Stemming
  - OOV-Wortmodell aus Trigramm-Likelihood, VokalverhÃ¤ltnis, Bigrammratio, Konsonantenlauf und WortlÃ¤ngen-Prior
  - lokaler Re-Split-Phase fÃ¼r lange unbekannte Runs in bis zu 3 plausible WÃ¶rter
  - Boundary-QualitÃ¤t statt Split-QuantitÃ¤t (Boundary-Kosten, Short-Token-Skepsis, Bridge-NachbarschaftsprÃ¼fung)
- Generische Prefix-Matches sind bewusst kein primÃ¤rer Segmentpfad mehr, weil sie Fehlgriffe wie `TEXTELH -> TEXT` oder `UNDENE -> UND` systematisch Ã¼berbewerten.
- `rankCandidates(...)` nutzt dieselbe Shared-Analyse wie Playfair, damit lokales Kandidatenranking und Playfair-Scoring konsistent bleiben.

## 4) UI-Darstellung

1. Kandidatenliste
- Zeigt SchlÃ¼ssel (wenn vorhanden), Score und ggf. WÃ¶rterbuchabdeckung.
 
2. Statusmeldungen
- API verfÃ¼gbar: Hinweis auf API-Nachbewertung.
- API nicht verfÃ¼gbar: Hinweis auf lokales Scoring.
- 0% Abdeckung: zusÃ¤tzlicher Hinweis.
- Bei aktivem Bruteforce-Fallback kann der Endstatus Dauer + Kombinationsanzahl anzeigen.

## 5) Grenzen und Nebenwirkungen

- WÃ¶rterbuch-Reranking kann lokales Cipher-Ranking bewusst Ã¼berstimmen.
- Sehr kurze Texte bleiben trotz Heuristiken unsicher (besonders VigenÃ¨re).
- API-AusfÃ¤lle dÃ¼rfen FunktionalitÃ¤t nicht blockieren.

## 6) Parser-Vorpriorisierung (Dateiimport)

- Bei JS-Importen werden Kandidaten weiterhin Ã¼ber Key-Pfade gewichtet; reine Literal-Fallbacks bleiben neutral (`_literal`).
- Bei CSV-Importen erfolgt die Erkennung der Textspalte Ã¼ber exakte Header-Tokens statt Ã¼ber Teilwort-Treffer.
- Diese Vorpriorisierung betrifft nur die Textextraktion aus Dateien und Ã¤ndert nicht das Cipher- oder WÃ¶rterbuch-Scoring.

