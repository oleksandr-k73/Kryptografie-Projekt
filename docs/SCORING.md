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

2. Affine (`affineCipher.js`)
- Alphabet ist editierbar (Standard `A-Z`), Modulo `m = alphabet.length`.
- `crack(...)` testet alle `a` mit `gcd(a,m)=1` und alle `b` in `0..m-1`.
- Sprach-Scoring und Kandidatenranking sind identisch zum Cäsar-Verfahren.

3. Vigenère (`vigenereCipher.js`)
- Nutzt:
  - Schlüssellängen-Kandidaten (IoC-basiert)
  - Spaltenweise Shift-Rangfolge (Chi-Quadrat)
  - budgetierte Kandidatensuche
  - Kurztext-Rettungsmodus
  - lokale Verfeinerung per Search
  - Sprach-Scoring auf Kandidatentext
- Optionaler `keyLength`-Hint erhöht Präzision und reduziert Suchraum.
- `keyLength`-Hint wird auf die testbare Buchstabenlänge geclampet und konsistent in
  Schlüssellängen-Kandidaten, Divisor-Erweiterung und Fallback-Gates genutzt.
- Kurztext-Fallback nutzt staged Breiten `[12,18,26]` und läuft nur bei kurzen, sinnarmen Texten
  innerhalb `maxKeyLength`.
- Mit `keyLength`-Hint gilt `maxElapsedMs = min(remainingTotalMs, maxMsPerLength)`; ohne Hint bleibt
  ein adaptives Budget aktiv.
- Chi-Memo-Cache ist begrenzt (`MAX_CHI_MEMO_CACHE_SIZE`) und wird pro Session zurückgesetzt.
- Sense-Metriken basieren u. a. auf `dictCoverageProxy`, `meaningfulTokenRatio` und `gibberishBigramRatio`.
- Fallback-Score kombiniert Sprachscore, Dictionary-Boost und Sense-Bonus; ersetzt Basiskandidat nur
  bei klarer Qualitätsverbesserung.

4. Playfair (`playfairCipher.js`)
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
  - Phase A: deterministische Key-Shortlist (inkl. `QUANT`, `FAC`)
  - Phase B: erweitertes Key-Corpus aus Lexikonbegriffen + Präfix-/Stem-Varianten
- Candidate-Scoring gewichtet primär `qualityScore` plus Segmentierungs-Confidence/Coverage.
- Ambiguitäts-Gate (Default): `minConfidence = 11.2`, `minDelta = 1.8`, `minCoverage = 0.62`.
- Fallback-Trigger, wenn mindestens eine Gate-Bedingung erfüllt ist.
- Für die UI wird zusätzlich der Rohtext inklusive Padding-`X` bereitgestellt.

5. Leetspeak (`leetCipher.js`)
- Beam-Search für Rückübersetzungen.
- Übergangs-Scoring während der Sequenzbildung.
- Sprach-Scoring auf erzeugtem Klartext.
- Liefert primär den besten Kandidaten.

6. Rail Fence (`railFenceCipher.js`)
- Schlüsselbasiert (`supportsKey: true`), Schlüssel ist die Schienenanzahl als ganze Zahl `>= 2`.
- Im UI nutzt Rail Fence dasselbe Feld als Entschlüsselungswert oder als Trigger für den Crack-Pfad.
- Ver- und Entschlüsselung laufen über den kompletten Zeichenstrom, nicht nur über Buchstaben.
- `crack(...)` interpretiert `options.keyLength` als Schienen-Hint.
- Ohne Hint testet Rail Fence exakt `2..min(12, text.length - 1)`.
- Mit `dictionaryScorer.analyzeTextQuality(...)` gilt:
  - `score = qualityScore + coverage * 10 + meaningfulTokenRatio * 8 + max(0, 1 - abs(spaceRatio - 0.16) * 4) - (rails / maxRails) * 0.35`
- Tie-Breaker: kleinere Rail-Anzahl zuerst.
- Ohne Dictionary-Scorer greift ein lokales Fallback aus häufigen Wörtern, Bigrammen/Trigrammen und Leerzeichen-Bonus.
- `displayText` wird nur im Crack-Pfad als Ausgabe genutzt; `decrypt(...)` liefert Rohtext, auch wenn Segmentierung möglich wäre.
- Im UI wird beim Entschlüsseln der Rohtext segmentiert angezeigt; der Rohtext bleibt separat sichtbar.

7. Skytale (`scytaleCipher.js`)
- Normalisiert auf `A-Z`, padde mit `X` bis zum nächsten Vielfachen des Umfangs.
- Crack-Range: ohne Hint `2..min(12, letters.length)`, mit Hint exakt diese Zahl.
- Scoring nutzt `dictionaryScorer.analyzeTextQuality(...)` und liefert:
  - `qualityScore` als primären Kandidatenscore
  - `displayText` für die lesbare Segmentierung
  - `rawText` als gepaddeten Rohtext
- Scoring trimmt End-`X`, bewertet bei geringer Coverage `displayText` erneut und penalisiert interne `X`-Häufungen; Domain-Wörter erhalten einen Bonus.

8. Columnar Transposition (`columnarTranspositionCipher.js`)
- Normalisiert auf `A-Z` und padde mit `X` bis zum nächsten Vielfachen der Spaltenanzahl.
- Crack-Range: ohne Hint `2..min(6, letters.length)`, mit `keyLength` exakt diese Länge.
- Fallback-Score nutzt Bigramme/Trigramme, Domain-Wort-Bonus und eine Penalty für interne `X`-Häufungen.
- Shortlist-Rescoring über `dictionaryScorer.analyzeTextQuality(...)` liefert `displayText` und behält `rawText` (inkl. Padding).

9. Hill (`hillCipher.js`)
- Normalisiert auf `A-Z` (inkl. Umlaut-Transliteration) und padde mit `X` bis zur Blockgröße.
- Keyless‑Crack ist auf 2×2‑Matrizen begrenzt; Bruteforce prüft Werte `0..25` und nur invertierbare Matrizen.
- Scoring nutzt `dictionaryScorer.analyzeTextQuality(...)` auf dem Rohtext ohne End‑`X` und kombiniert:
  - `qualityScore` als Basis
  - `coverage * 10` und `meaningfulTokenRatio * 7`
  - Domain‑Bonus über fachtypische Wörter
- Fallback‑Score nutzt Bigramme/Trigramme, damit Crack ohne Scorer stabil bleibt.
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

