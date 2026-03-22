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

2. Zahlen‑Cäsar (`numberCaesarCipher.js`)
- Dekodiert A1Z26 zu A‑Z und testet 26 Verschiebungen wie der klassische Cäsar.
- Sprach-Scoring entspricht exakt dem Cäsar-Verfahren (Wörter, Bi-/Trigramme, Chi-Quadrat, Vokal-/Leerzeichenverhältnis).
- `rawText` bleibt ohne Leerzeichen; die Segmentierung passiert im UI‑Pfad.

3. Affine (`affineCipher.js`)
- Alphabet ist editierbar (Standard `A-Z`), Modulo `m = alphabet.length`.
- `crack(...)` testet alle `a` mit `gcd(a,m)=1` und alle `b` in `0..m-1`.
- Sprach-Scoring und Kandidatenranking sind identisch zum Cäsar-Verfahren.

4. Vigenère (`vigenereCipher.js`)
- Nutzt IoC/Chi zur Längenwahl, budgetierte Kandidatensuche, Kurztext-Fallback, lokale Verfeinerung und Sprach-Scoring.
- Optionaler `keyLength`-Hint erhöht Präzision und reduziert Suchraum.
- `keyLength`-Hint wird auf die testbare Buchstabenlänge geclampet und in Kandidaten/Gates konsistent genutzt.
- Kurztext-Fallback nutzt staged Breiten `[12,18,26]` innerhalb `maxKeyLength`.
- Budget: mit `keyLength` gilt `maxElapsedMs = min(remainingTotalMs, maxMsPerLength)`, ohne Hint adaptiv.

5. Playfair (`playfairCipher.js`)
- Didaktische Normalisierung: `J -> I`, nur `A-Z`, Bigramme mit `X`-Filler, `X`-Padding.
- Postprocessing entfernt didaktische `X`-Einfügungen; Segmentierung/Qualitätsanalyse läuft über `dictionaryScorer.analyzeTextQuality(...)` (Offline-Artifact `segmentLexiconData.js` davor laden).
- Hybrid-Crack: Phase A (deterministische Key-Shortlist) + Phase B (Lexikon + Präfix-/Stem-Varianten).
- Candidate-Scoring nutzt primär `qualityScore` plus Segmentierungs-Confidence/Coverage; Ambiguitäts-Gate triggert Fallback.
- Für die UI wird zusätzlich der Rohtext inklusive Padding-`X` bereitgestellt.

6. Leetspeak (`leetCipher.js`)
- Beam-Search für Rückübersetzungen.
- Übergangs-Scoring während der Sequenzbildung.
- Sprach-Scoring auf erzeugtem Klartext.
- Liefert primär den besten Kandidaten.

7. Rail Fence (`railFenceCipher.js`)
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

8. Skytale (`scytaleCipher.js`)
- Normalisiert auf `A-Z`, padde mit `X` bis zum nächsten Vielfachen des Umfangs.
- Crack-Range: ohne Hint `2..min(12, letters.length)`, mit Hint exakt diese Zahl.
- Scoring nutzt `dictionaryScorer.analyzeTextQuality(...)` und liefert:
  - `qualityScore` als primären Kandidatenscore
  - `displayText` für die lesbare Segmentierung
  - `rawText` als gepaddeten Rohtext
- Scoring trimmt End-`X`, bewertet bei geringer Coverage `displayText` erneut und penalisiert interne `X`-Häufungen; Domain-Wörter erhalten einen Bonus.

9. Columnar Transposition (`columnarTranspositionCipher.js`)
- Normalisiert auf `A-Z` und padde mit `X` bis zum nächsten Vielfachen der Spaltenanzahl.
- Crack-Range: ohne Hint `2..min(6, letters.length)`, mit `keyLength` exakt diese Länge.
- Fallback-Score nutzt Bigramme/Trigramme, Domain-Bonus, X-Penalty und kleinen Längen-Malus.
- Shortlist-Rescoring über `dictionaryScorer.analyzeTextQuality(...)` liefert `displayText` und behält `rawText` (inkl. Padding).

10. Positionscipher (`positionCipher.js`)
- Normalisiert auf `A-Z` und padde mit `X` bis zum nächsten Vielfachen der Blocklänge.
- Crack-Range: ohne Hint Blocklängen `2..min(6, letters.length)`, mit `keyLength` exakt diese Länge.
- Fallback-Score nutzt Bigramme/Trigramme, Domain-Wort-Bonus und eine Penalty für interne `X`-Häufungen.
- Shortlist-Rescoring über `dictionaryScorer.analyzeTextQuality(...)` liefert `displayText`, behält `rawText` (inkl. Padding) und nutzt:
  - `confidence = qualityScore + coverage * 10 + meaningfulTokenRatio * 8 - internalXPenalty + domainBonus`

11. Hill (`hillCipher.js`)
- Normalisiert auf `A-Z` (inkl. Umlaut-Transliteration) und padde mit `X` bis zur Blockgröße.
- Keyless‑Crack ist auf 2×2‑Matrizen begrenzt; Bruteforce prüft Werte `0..25` und nur invertierbare Matrizen.
- Scoring nutzt `dictionaryScorer.analyzeTextQuality(...)` auf dem Rohtext ohne End‑`X` und kombiniert:
  - `qualityScore` als Basis
  - `coverage * 10` und `meaningfulTokenRatio * 7`
  - Domain‑Bonus über fachtypische Wörter
- Fallback‑Score nutzt Bigramme/Trigramme, damit Crack ohne Scorer stabil bleibt.
12. XOR (`xorCipher.js`)
- Byte-basiert: UTF-8 kodieren, XOR mit ASCII-Key, Ausgabe als HEX uppercase.
- Crack bewertet pro Schlüsselposition die Slice-Bytes und kombiniert Kandidaten per k‑best‑Enumeration (Score‑Summe), um die besten Schlüssel je Länge zu prüfen.
- Ohne Hint werden die Top‑3 Längen per Base‑Score vorselektiert (bis `DEFAULT_MAX_KEY_LENGTH = 8`).
- Primär wird auf A-Z/Leerzeichen/Ziffern optimiert, Fallback erweitert auf printable ASCII 0x20–0x7E.
- Ranking via `dictionaryScorer.analyzeTextQuality(...)` mit kurzer Shortlist, sonst XOR-Fallback-Score.
13. Base64 (`base64Cipher.js`)
- Kein Schlüssel; Crack dekodiert deterministisch (kein echtes Key-Cracking).
- Confidence kommt aus `dictionaryScorer.analyzeTextQuality(...)`; bei fehlendem Scorer greifen lokale Heuristiken.
- `crack(...)` liefert `rawText`; segmentiertes `text` nur bei identischem Inhalt (z. B. keine Ziffern verloren gehen).

14. Binärcode (8-Bit) (`binaryCipher.js`)
- Kein Schlüssel; Crack dekodiert deterministisch aus 8-Bit-Gruppen.
- Confidence via `dictionaryScorer.analyzeTextQuality(...)`; Segmentierung nur bei identischem Inhalt.

15. HEX (UTF-8) (`hexCipher.js`)
- Kein Schlüssel; Crack dekodiert deterministisch aus HEX.
- Confidence via `dictionaryScorer.analyzeTextQuality(...)`; Segmentierung nur bei identischem Inhalt.

16. ASCII (Dezimalcodes) (`asciiCipher.js`)
- Kein Schlüssel; Crack dekodiert deterministisch aus whitespace-separierten Dezimalwerten `0..255`.
- Confidence basiert auf `dictionaryScorer.analyzeTextQuality(...)` und kombiniert `qualityScore + coverage * 12 + meaningfulTokenRatio * 6`.
- Ohne Dictionary-Scorer greift ein lokales Heuristik-Scoring.
- Segmentierung wird nur übernommen, wenn der sichtbare Inhalt unverändert bleibt (Whitespace-neutraler Vergleich).
17. RSA Mini (`rsaMiniCipher.js`)
- Kein Sprach-Scoring: Crack nutzt den Hinweis `d,n` und liefert deterministisch `confidence = 1`.
- Eingabe/Ausgabe bleiben Zahlentokens; es gibt keine Segmentierung oder Wörterbuch-Reranks.

18. SHA-256 (`sha256Cipher.js`)
- Kein Schlüssel (`supportsKey: false`); kryptografische Einwegfunktion.
- `encrypt(...)` hashed den UTF-8-Input zu 64-stelliger uppercase HEX (deterministisch, keine Kandidaten).
- `decrypt(...)` wirft einen klaren Fehler (SHA-256 ist nicht umkehrbar).
- `crack(text, options)` validiert, ob `text` ein gültiger 64-stelliger HEX-Hash ist:
  - Ungültige Input-Form → WIP mit Fehlermeldung.
  - Gültige Hash-Form ohne `options.candidates` → WIP mit Hinweis auf Kandidaten-Requirement.
  - Gültige Hash-Form mit `options.candidates`: testet jeden Kandidaten-Plaintext einzeln,
    gibt bei Match den Plaintext mit `confidence = 100` zurück, sonst WIP.
- WIP-Status signalisiert Work in Progress: `search.wip = true` und `search.wipMessage` sind gesetzt.
  `app.js` überspringt Ranking/Kandidaten-Rendering und zeigt nur die Statusmeldung.

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
- `bestCandidate` wird ausgegeben, Top-Kandidaten erscheinen im Kandidatenbereich.

## 3) Wörterbuch-Reranking (`js/core/dictionaryScorer.js`)

1. Tokenisierung
- Extrahiert Wörter aus Kandidatentexten.
- Normalisiert (u. a. Kleinbuchstaben, `ß -> ss`).
- Dedupliziert und begrenzt die Wortanzahl pro Kandidat.

2. Validierung
- API-Prüfung über `dictionaryapi.dev` je Sprache (`de`, `en`) mit Timeout.
- Reachability-Probe läuft über alle `languageHints` (Fallback `en`).
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
- Quellen: Seeds (`languageHints`), optionale `seedWords`, Text-Token, lokales Lexikon.
- Quellen werden mit Präfix-/Stem-Varianten erweitert, um robuste Key-Korpora ohne Vollraumsuche zu liefern.

6. Shared-Textsegmentierung
- `analyzeTextQuality(text, options?)` liefert `rawText`, `displayText`, Tokens, Coverage und `qualityScore` als zentrale Scoringbasis.
- `segmentText(...)` bleibt API-kompatibel und spiegelt intern `analyzeTextQuality(...)`.
- Segmentierung nutzt DP auf `A-Z`-Runs mit Lexikon (`segmentLexiconData.js`) und OOV-Modell; Boundary-Qualität zählt mehr als Split-Quantität.
- `rankCandidates(...)` nutzt dieselbe Shared-Analyse wie Playfair, damit lokales Ranking und Playfair-Scoring konsistent bleiben.

## 4) UI-Darstellung

1. Kandidatenliste
- Zeigt Schlüssel (wenn vorhanden), Score und ggf. Wörterbuchabdeckung.

2. Statusmeldungen
- Hinweise auf API-Nachbewertung bzw. lokales Scoring.

3. Cipher-Hinweise im Dropdown
- Die Verschlüsselungsauswahl nutzt ein Custom-Dropdown.
- Für Vigenère wird `info.note` als Tooltip angezeigt, sobald die Option fokussiert oder mit der Maus anvisiert wird.

## 5) Grenzen und Nebenwirkungen

- Wörterbuch-Reranking kann lokales Cipher-Ranking bewusst überstimmen.
- Sehr kurze Texte bleiben trotz Heuristiken unsicher (besonders Vigenère).
- API-Ausfälle dürfen Funktionalität nicht blockieren.

## 6) Parser-Vorpriorisierung (Dateiimport)

- Bei JS-Importen werden Kandidaten weiter über Key-Pfade gewichtet; reine Literal-Fallbacks bleiben neutral (`_literal`).
- Bei CSV-Importen erfolgt die Textspaltenwahl über exakte Header-Tokens statt Teilwort-Treffern.
- Die Vorpriorisierung betrifft nur die Textextraktion, nicht das Cipher- oder Wörterbuch-Scoring.

