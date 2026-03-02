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
- Dropdown und UI-Zustände werden initial gesetzt.
 

2. Eingabe
- Textquelle:
  - manuelle Eingabe im Textfeld
  - Datei-Upload
  - Drag-and-drop
- Datei wird über `parseInputFile(file)` gelesen und zu `inputText`.

3. Dateiparsing (`js/core/fileParsers.js`)
- Format nach Extension.
- Unterstützt: `txt`, `log`, `md`, `json`, `csv`, `js`, `mjs`, `cjs`.
- Unbekanntes Format: Fallback als Klartext (`fallback: true`).

4. Ausführung (`runCipher`)
- Validiert, ob Text vorhanden ist.
- Liest Modus (`encrypt`/`decrypt`) und gewählten Cipher.
- Optional: Schlüssel-Parsing und Crack-Optionen.
 

5. Verschlüsseln
- `cipher.encrypt(text, key)` wird aufgerufen.
- Ergebnis landet in `outputText`.
- Kandidatenbereich wird ausgeblendet.

6. Entschlüsseln mit bekanntem Schlüssel
- `cipher.decrypt(text, key)` wird aufgerufen.
- Ergebnis landet in `outputText`.
- Kandidatenbereich wird ausgeblendet.

7. Entschlüsseln ohne Schlüssel (Knacken)
- Bei Vigenère setzt die UI vor `cipher.crack(...)` den Hinweis:
  - `Vigenère: Bruteforce-Prüfung läuft gegebenenfalls, bitte warten ...`
  - `runButton` wird deaktiviert
  - `requestAnimationFrame` wird einmal abgewartet, damit der Hinweis sichtbar ist
 
- `cipher.crack(text, options)` liefert besten Kandidaten und optional `candidates`.
- Vigenère nutzt bei kurzem Text + niedriger Sinnhaftigkeit + kleiner Schlüssellänge einen staged Bruteforce-Fallback (`[12,18,26]`).
- Ohne `keyLength`-Hint wird dieser Fallback nur bei adaptiv günstigen Fällen aktiviert (`maxMsPerLength`-Gate).
- Kandidaten werden normalisiert und nach `confidence` sortiert.
- Optionales Reranking via `dictionaryScorer.rankCandidates(...)`.
- Bester Kandidat wird als Ausgabe gesetzt.

8. Status und Hinweise
- Bei geringer Wörterbuchabdeckung zeigt die UI Hinweise.
- Bei Vigenère + kurzem Text wird ein Zuverlässigkeits-Hinweis ergänzt.
- API-Verfügbarkeit beeinflusst den Kandidatenstatus-Text.
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
 

## Ergebnisgarantie auf UI-Ebene

- Jeder erfolgreiche Lauf setzt eine Ausgabe in `outputText`.
- Kandidatenliste erscheint nur bei mehreren Kandidaten.
- Statuszeile erläutert den tatsächlich gewählten Pfad.
