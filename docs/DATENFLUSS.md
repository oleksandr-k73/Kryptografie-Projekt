---
name: datenfluss
description: Laufzeit-Datenfluss von Eingabe bis Ausgabe inklusive Fallbacks und Kandidaten-Ranking.
---

# Laufzeit-Datenfluss

## Ziel
Diese Datei beschreibt den tatsächlichen Laufzeitpfad in `js/app.js` und den beteiligten Core-Modulen.

## Ablauf

1. Initialisierung
- `app.js` lädt `KryptoCore` und `KryptoCiphers`.
- `CipherRegistry` registriert alle gültigen Cipher.
- Custom-Dropdown und UI-Zustände werden initial gesetzt.
 

2. Eingabe
- Textquelle:
  - manuelle Eingabe im Textfeld
  - Datei-Upload
  - Drag-and-drop
- Datei wird über `parseInputFile(file)` gelesen und zu `inputText`.

3. Dateiparsing (`js/core/fileParsers.js`)
- Format nach Extension.
- Unterstützt: `txt`, `log`, `md`, `json`, `csv`, `js`, `mjs`, `cjs`, `xml`, `yaml`, `yml`.
- XML nutzt priorisierte Strict-Tags (`coded`, `ciphertext`, `cipher`, `text`, `message`, `payload`, `content`, `data`, `body`);
  Prefix-Tags wie `codedExport` matchen bewusst nicht als `coded`.
- XML ohne priorisierten Treffer fällt auf Tag-Strip + Whitespace-Normalisierung zurück.
- YAML parst einen konservativen Browser-Subset (Mappings, Sequenzen, Block-Scalars) und nutzt danach dieselbe String-Extraktion wie JSON.
- YAML mit nicht getragenen Features (z. B. Anchors/Aliases) fällt defensiv auf den Originaltext zurück.
- JS-Parser bewertet reine Literal-Fallback-Kandidaten neutral über den Pfad `_literal`,
  damit starke Schlüssel wie `value` nur bei echten Key-Signalen aus Assignment/Property wirken.
- CSV-Textspaltenwahl nutzt exakte Header-Tokens (Delimiter: `_`, Leerzeichen, `-`);
  ohne erkannte Textspalte bleibt der Zeilen-Fallback aktiv.
- Header-Heuristik entfernt die erste Zeile nur bei starkem Signal, damit headerlose Dateien stabil bleiben.
- Unbekanntes Format: Fallback als Klartext (`fallback: true`).

4. Ausführung (`runCipher`)
- Validiert, ob Text vorhanden ist.
- Liest Modus (`encrypt`/`decrypt`) und gewählten Cipher.
- Optional: Schlüssel-Parsing und Crack-Optionen.
- Für Ciphers mit `supportsAlphabet` wird ein editierbares Alphabet gelesen,
  an `parseKey(...)` sowie `crackOptions.alphabet` übergeben und bei Abweichung vom Standard
  ein Warnhinweis im Status angezeigt.
 

5. Verschlüsseln
- `cipher.encrypt(text, key)` wird aufgerufen.
- Ergebnis landet in `outputText`.
- Kandidatenbereich wird ausgeblendet.
- XOR zeigt HEX als Hauptausgabe und den Klartext im Rohfeld.

6. Entschlüsseln mit bekanntem Schlüssel
- `cipher.decrypt(text, key)` wird aufgerufen.
- Ergebnis landet segmentiert in `outputText`; bei Rail Fence, Skytale, Columnar Transposition, Hill und Playfair wird zusätzlich der Rohtext (ungegliedert) angezeigt.
- Kandidatenbereich wird ausgeblendet.
- XOR zeigt Klartext im Hauptfeld und die normalisierte HEX-Eingabe im Rohfeld (ohne Segmentierung).

7. Entschlüsseln ohne Schlüssel (Knacken)
- Bei Vigenère setzt die UI vor `cipher.crack(...)` den Hinweis:
  - `Vigenère: Bruteforce-Prüfung läuft gegebenenfalls, bitte warten ...`
  - `runButton` wird deaktiviert
  - `requestAnimationFrame` wird einmal abgewartet, damit der Hinweis sichtbar ist
 
- `cipher.crack(text, options)` liefert besten Kandidaten und optional `candidates`.
- Bei Playfair ergänzt `app.js` optional `dictionaryScorer.getKeyCandidates(...)` im
  `options`-Objekt, damit der Cipher eine deterministische Key-Shortlist für Phase B nutzen kann.
- Rail Fence nutzt im UI dasselbe Schienen-Feld für beides:
  - leer = knacken
  - Zahl = direkt entschlüsseln
- Skytale nutzt im UI dasselbe Umfang-Feld für beides:
  - leer = knacken
  - Zahl = direkt entschlüsseln
- Playfair nutzt zusätzlich ``dictionaryScorer.analyzeTextQuality(...)`` für Ausgabe + Score;
  derselbe Pfad läuft sowohl bei `decrypt(...)` mit bekanntem Schlüssel als auch im Crack-Scoring.
- Vigenère kann nach dem regulären Chi/Frequenzpfad in einen staged Bruteforce-Fallback (`[12,18,26]`) wechseln.
- Weitere cipher-spezifische Crack-Details (Playfair-Phasen, Rail Fence/Skytale Segmentierung, Columnar/Hill-Shortlists) siehe `docs/SCORING.md`.
- Im UI-Pfad setzt `app.js` für Vigenère standardmäßig `optimizations: true`.
- Bei `keyLength`-Hint wird das Fallback-Budget direkt über `maxMsPerLength` begrenzt.
- Ohne `keyLength`-Hint wird der Fallback zusätzlich über ein adaptives Größen-Gate begrenzt.
- Die konkrete Gate-/Sense-Logik liegt in `docs/SCORING.md`; hier bleibt nur der Laufzeitpfad dokumentiert.
- Kandidaten werden normalisiert und nach `confidence` sortiert.
- Optionales Reranking via `dictionaryScorer.rankCandidates(...)`.
- `rankCandidates(...)` nutzt dieselbe Shared-Textanalyse wie Playfair-Scoring.
- Bester Kandidat wird als Ausgabe gesetzt.
- Für Rail Fence, Skytale, Columnar Transposition, Hill und Playfair wird zusätzlich der Rohtext aus `rawText` angezeigt.
- XOR zeigt Klartext + HEX-Rohtext, ohne Segmentierung des HEX-Outputs.

8. Status und Hinweise
- Bei geringer Wörterbuchabdeckung zeigt die UI Hinweise.
- Bei Vigenère + kurzem Text wird ein Zuverlässigkeits-Hinweis ergänzt.
- API-Verfügbarkeit beeinflusst den Kandidatenstatus-Text.
- Hover/Fokus auf der Vigenère-Option im Custom-Dropdown zeigt einen Alias-Hinweis (Tooltip).
- Nach dem Crack wird `runButton` wieder aktiviert.
- Falls Fallback lief, kann der Endstatus Bruteforce-Info enthalten.
- Fallback-Telemetrie wird defensiv formatiert, damit keine `NaN`/`undefined`-Werte im Status erscheinen.

9. Kopieren
- Primär `navigator.clipboard.writeText(...)`.
- Fallback: `document.execCommand("copy")`.

## Fehler- und Fallback-Verhalten

1. Parsingfehler
- Datei kann nicht gelesen oder geparst werden: Statusmeldung mit Fehlermeldung.

2. Ungültige Eingaben
- Kein Text, ungültiger Cipher, ungültige Schlüssellänge: nutzernahe Fehlermeldung.

3. Wörterbuch-API nicht verfügbar
- Kein Abbruch.
- Lokales Scoring bleibt aktiv, `apiAvailable = false`.
- API-Verfügbarkeit folgt Reachability-/Wortcheck-Ergebnissen und nicht nur der Existenz von `fetch`.

4. Fehlender Dictionary-Scorer
- Kandidaten bleiben in lokalem Cipher-Ranking.

5. Bruteforce-Telemetrie (`result.search`)
- `bruteforceFallbackTriggered`
- `bruteforceFallbackReason`
- `bruteforceFallbackKeyLength`
- `bruteforceCombosVisited`
- `bruteforceElapsedMs`
- `sense`
- Playfair-Telemetrie ergänzt:
  - `phase` (`A` oder `B`)
  - `fallbackTriggered`
  - `fallbackReasons`
  - `gate` (inkl. `minConfidence`, `minDelta`, `minCoverage`)
 

## Ergebnisgarantie auf UI-Ebene

- Jeder erfolgreiche Lauf setzt eine Ausgabe in `outputText`.
- Kandidatenliste erscheint nur bei mehreren Kandidaten.
- Statuszeile erläutert den tatsächlich gewählten Pfad.


