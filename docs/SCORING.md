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

3. Leetspeak (`leetCipher.js`)
- Beam-Search für Rückübersetzungen.
- Übergangs-Scoring während der Sequenzbildung.
- Sprach-Scoring auf erzeugtem Klartext.
- Liefert primär den besten Kandidaten.

## 2) Kandidatenfluss in `app.js`

1. `crack(...)`-Ergebnis wird normalisiert:
- Mindestfelder: `key`, `text`, `confidence`
- optional: `candidates`

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
- Wörterbuch-Anteil:
  - `dictBoost = coverage * 20 + validWords * 1.2`
- Malus:
  - `zeroPenalty = -3.2`, wenn mindestens 2 Wörter geprüft und 0 erkannt
- Gesamtscore:
  - `combinedScore = base * 0.35 + dictBoost + zeroPenalty`

4. Sortierung
- Primär nach `combinedScore` absteigend.
- Tie-Breaker: ursprüngliche Reihenfolge (`rankIndex`).

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
