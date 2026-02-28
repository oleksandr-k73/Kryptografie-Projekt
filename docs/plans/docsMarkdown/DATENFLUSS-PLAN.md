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
- Dropdown wird aus der Registry befüllt.
- UI-Zustände werden initial gesetzt (`Schlüssel`, `Schlüssellänge`, Verfahrensinfo, Kandidatenbereich).

2. Eingabe
- Textquelle:
  - manuelle Eingabe im Textfeld
  - Datei-Upload
  - Drag-and-drop
- Datei wird über `parseInputFile(file)` gelesen und zu `inputText`.

3. Dateiparsing (`js/core/fileParsers.js`)
- Format nach Extension.
- Unterstützt: `txt`, `log`, `md`, `json`, `csv`, `js`, `mjs`, `cjs`.
- JSON/JS: String-Kandidaten-Heuristik, JSON-Tiefensuche bis Tiefe `12`.
- Unbekanntes Format: Fallback als Klartext (`fallback: true`).

4. Ausführung (`runCipher`)
- Validiert, ob Text vorhanden ist.
- Liest Modus (`encrypt`/`decrypt`) und gewählten Cipher.
- Optional: Schlüssel-Parsing über `cipher.parseKey`.
- Optional: Crack-Optionen (z. B. `keyLength`) werden gelesen und validiert.

5. Verschlüsseln
- `cipher.encrypt(text, key)` wird aufgerufen.
- Ergebnis landet in `outputText`.
- Kandidatenbereich wird ausgeblendet.

6. Entschlüsseln mit bekanntem Schlüssel
- `cipher.decrypt(text, key)` wird aufgerufen.
- Ergebnis landet in `outputText`.
- Kandidatenbereich wird ausgeblendet.

7. Entschlüsseln ohne Schlüssel (Knacken)
- `cipher.crack(text, options)` liefert besten Kandidaten und optional `candidates`.
- Kandidaten werden normalisiert und nach `confidence` sortiert.
- Optionales Reranking via `dictionaryScorer.rankCandidates(...)`.
- Bester Kandidat wird als Ausgabe gesetzt.
- Top-Kandidaten werden separat angezeigt.

8. Status und Hinweise
- Bei geringer Wörterbuchabdeckung zeigt die UI Hinweise.
- Bei Vigenère + kurzem Text wird ein Zuverlässigkeits-Hinweis ergänzt.
- API-Verfügbarkeit beeinflusst den Kandidatenstatus-Text.

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

4. Fehlender Dictionary-Scorer
- Kandidaten bleiben in lokalem Cipher-Ranking.

## Ergebnisgarantie auf UI-Ebene

- Jeder erfolgreiche Lauf setzt eine Ausgabe in `outputText`.
- Kandidatenliste erscheint nur bei mehreren Kandidaten.
- Statuszeile erläutert den tatsächlich gewählten Pfad.
