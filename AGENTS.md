## 1) Projektüberblick

Dieses Projekt ist eine browserbasierte Kryptografie-Werkbank (`index.html` + Vanilla JS), die Texte aus Dateien oder manueller Eingabe verarbeitet. Ziel ist, verschiedene Verschlüsselungsverfahren zu ver- und entschlüsseln und im Entschlüsselungsmodus ohne Schlüssel automatisches Knacken zu unterstützen.

### Kernprinzipien der Architektur
- Erweiterbarkeit: erweiterbare Cipher-Architektur
- Robustheit: robuste Eingabeverarbeitung (mehrere Dateiformate)

### Aktuell liegt der Fokus auf:
- nachvollziehbarer UI mit Moduswahl, Verfahrensinfo und Kandidatenanzeige
- kombinierter Bewertung von Kandidaten (Sprachheuristik + Wörterbuchprüfung)

## Pflege- und Aktualisierungsregel

Diese Dokumentation ist ein Arbeitsstand und kein statisches Lastenheft.

Was periodisch aktualisiert werden soll:
- alle dynamischen Abschnitte (insbesondere Funktionsumfang, Architektur/Dateistruktur, Laufzeit-Datenfluss, bekannte Grenzen/Annahmen, Erweiterungsregeln, Cipher-Details)
- nach Änderungen an Parsing, Scoring, UI-Logik, Cipher-Implementierungen oder Fehlerbehebungen
- spätestens bei Übergabe an eine neue Session

Was nicht ohne explizite Freigabe geändert werden darf:
- Projektziele und Kernprinzipien in Abschnitt `1) Projektüberblick`
- langfristige Architekturentscheidung in Abschnitt `3) Architektur und Dateistruktur`: "Die Anwendung ist als modulare, skriptbasierte Browser-App aufgebaut (ohne Build-Tooling)."

## 2) Aktueller Funktionsumfang

Status: Dynamisch (periodisch aktualisieren)

Die aktuelle UI und Logik umfasst:
- Datei-Upload per Dateiauswahl und Drag-and-drop
- Unterstützte Eingabeformate: TXT, JSON, CSV, LOG, MD, JS/MJS/CJS
- Moduswahl: Verschlüsseln / Entschlüsseln
- Auswahl der Verschlüsselungsmethode über Dropdown
- Optionales Schlüsselfeld (abhängig vom Verfahren)
- Optionales Feld für Schlüssellänge beim Vigenère-Knacken
- Ausgabe-Textfeld mit Kopierfunktion
- Verfahrens-Infobox (Zweck, Funktionsweise, Crack-Hinweis, Einsatzbereich)
- Top-Kandidaten-Anzeige beim Knacken (inkl. Score und Wörterbuch-Abdeckung)

## 3) Architektur und Dateistruktur

Status: Teilweise dynamisch (Architekturgrundsatz stabil, Details periodisch aktualisieren)

Die Anwendung ist als modulare, skriptbasierte Browser-App aufgebaut (ohne Build-Tooling).

### Einstieg und UI
- `index.html`: UI-Struktur, Eingabefelder, Infobox, Kandidatenbereich, Script-Reihenfolge
- `styles.css`: Layout, Farben, responsive Darstellung, Komponenten-Styling

### Core-Module
- `js/core/cipherRegistry.js`
  - zentrale Registry für Verfahren
  - prüft Mindestform eines Ciphers (`id`, `name`, `encrypt`, `decrypt`, `crack`)
- `js/core/fileParsers.js`
  - Dateiformat-Erkennung über Extension
  - Parser für TXT/LOG/MD, JSON, CSV, JS/MJS/CJS
  - Heuristiken zur Textextraktion aus strukturierten Daten
- `js/core/dictionaryScorer.js`
  - Kandidaten-Reranking
  - Wörterbuchprüfung über API (`dictionaryapi.dev`) plus lokales Lexikon-Fallback

### Cipher-Module
- `js/ciphers/caesarCipher.js`
- `js/ciphers/leetCipher.js`
- `js/ciphers/vigenereCipher.js`

Alle Cipher hängen sich an `window.KryptoCiphers` an und werden in `app.js` automatisch registriert, wenn sie die erwartete Struktur erfüllen.

### Orchestrierung
- `js/app.js`
  - Initialisierung, Event-Wiring, Datei-Handling, Moduslogik
  - UI-Zustand (Schlüsselfeld, Schlüssellänge, Status, Kandidatenanzeige)
  - Aufruf der Crack-Funktion + optionales Dictionary-Reranking

## 4) Laufzeit-Datenfluss

Status: Dynamisch (periodisch aktualisieren)

Die Ablaufkette in der Anwendung ist aktuell:
1. Start/Initialisierung
   - `app.js` registriert alle gültigen Cipher aus `window.KryptoCiphers`.
   - Das Dropdown wird aus der Registry befüllt.
   - UI-Zustände (Schlüssel, Schlüssellänge, Verfahrensinfo) werden initial gesetzt.
2. Eingabe
   - Text kommt entweder direkt aus dem Textfeld oder über Datei-Upload/Drag-and-drop.
   - Dateiinhalt wird über `parseInputFile(...)` gelesen und in `inputText` übernommen.
3. Ausführung (`runCipher`)
   - Der ausgewählte Modus (`encrypt`/`decrypt`) und das Verfahren werden geprüft.
   - Optionaler Schlüssel wird verfahrensspezifisch geparst (`parseKey`), falls vorhanden.
4. Verschlüsseln
   - `cipher.encrypt(text, key)` wird aufgerufen.
   - Ergebnis geht in das Ausgabefeld; Kandidatenbereich wird ausgeblendet.
5. Entschlüsseln mit bekanntem Schlüssel
   - `cipher.decrypt(text, key)` wird aufgerufen.
   - Ergebnis geht direkt in das Ausgabefeld; Kandidatenbereich wird ausgeblendet.
6. Entschlüsseln ohne Schlüssel (Knacken)
   - Optionale Crack-Parameter (z. B. Schlüssellänge) werden eingelesen.
   - `cipher.crack(text, options)` liefert mindestens besten Kandidaten, optional mehrere.
   - Kandidaten werden normalisiert und optional durch `dictionaryScorer.rankCandidates(...)` nachbewertet.
   - Bester Kandidat wird als Ausgabe gesetzt; Top-Kandidaten werden separat angezeigt.
7. Kopieren
   - Kopier-Button nutzt primär `navigator.clipboard`, sonst Fallback über `document.execCommand("copy")`.

## 5) Bekannte Grenzen und Annahmen

Status: Dynamisch (periodisch aktualisieren)

- Das automatische Knacken ist heuristisch und liefert Wahrscheinlichkeiten, keine mathematisch garantierte Eindeutigkeit.
- Sehr kurze Texte sind beim Knacken unzuverlässig. Für Vigenère gibt es dafür bereits einen expliziten Hinweis im UI (bei kurzer Buchstabenlänge ohne Schlüssellängen-Hinweis).
- Die Wörterbuch-Nachbewertung nutzt `dictionaryapi.dev` und fällt bei fehlender API-Verfügbarkeit auf ein lokales Mini-Lexikon zurück.
- Die Wörterbuchprüfung arbeitet aktuell mit Sprach-Hinweisen `de` und `en`.
- Die Extraktion aus JSON/JS ist heuristisch:
  - JSON: Auswahl anhand von Feldnamen/Pfaden und Text-Scoring.
  - JS/MJS/CJS: Regex-basierte Erkennung von String-Literalen (Zuweisungen/Objektfelder/Literale), kein Ausführen von Code.
- Dateiformate werden über Dateiendung erkannt; unbekannte Endungen werden als Klartext übernommen.
- Bei Caesar und Vigenère werden nur ASCII-Buchstaben (`A-Z`, `a-z`) verschoben; andere Zeichen bleiben unverändert.
- Die JSON-Tiefensuche für String-Kandidaten ist begrenzt (`depth > 12` wird nicht weiter durchsucht).

## 6) Erweiterung eines neuen Verfahrens

Status: Dynamisch (periodisch aktualisieren)

So wird ein neues Cipher-Modul aktuell integriert:

1. Neue Datei unter `js/ciphers/` anlegen (z. B. `rot13Cipher.js`).
2. Modul an `window.KryptoCiphers` anhängen (IIFE-Muster wie bestehende Cipher).
3. Mindeststruktur bereitstellen:
   - `id` (string, eindeutig)
   - `name` (string)
   - `encrypt(text, key?)`
   - `decrypt(text, key?)`
   - `crack(text, options?)`
4. Optionale UI-Integration über Felder im Cipher-Objekt:
   - `supportsKey`
   - `keyLabel`, `keyPlaceholder`
   - `supportsCrackLengthHint`
   - `crackLengthLabel`, `crackLengthPlaceholder`
   - `info` mit `purpose`, `process`, `crack`, `useCase`
5. Optional `parseKey(raw)` ergänzen, wenn ein Schlüssel validiert/normalisiert werden soll.
6. Rückgabeformat von `crack(...)`:
   - mindestens `{ key, text, confidence }`
   - optional zusätzlich `candidates` als Array für Top-Kandidaten-Anzeige und Dictionary-Reranking.
7. Script in `index.html` vor `js/app.js` einbinden, damit das Modul bei App-Start registriert werden kann.

## 7) Cipher-spezifische Details (Cäsar, Leetspeak, Vigenère)

Status: Dynamisch (periodisch aktualisieren)

Hinweis: Dieser Abschnitt beschreibt den aktuellen Stand als Kontextdokumentation, nicht als starre Programmieranweisung. Bei neuen Anforderungen, Fehlerbehebungen oder nachweislich besseren Implementierungen darf und soll davon abgewichen werden, sofern Architekturprinzipien (Erweiterbarkeit/Robustheit) eingehalten werden.

### Cäsar (`js/ciphers/caesarCipher.js`)
- Schlüsselbasiertes Verfahren (`supportsKey: true`), Schlüssel als ganze Zahl.
- Ver-/Entschlüsselung per Buchstabenverschiebung modulo 26.
- Knacken testet alle 26 Schlüssel und bewertet Kandidaten über Sprach-Scoring.
- `crack(...)` liefert besten Treffer plus Kandidatenliste (Top-Auswahl).

### Leetspeak (`js/ciphers/leetCipher.js`)
- Kein Schlüssel erforderlich (`supportsKey: false`).
- Verschlüsselung per fester Substitutions-Tabelle (z. B. `a -> 4`, `e -> 3`).
- Entschlüsselung läuft über Crack-Logik.
- Knacken nutzt Beam-Search mit Übergangs- und Sprach-Scoring.

### Vigenère (`js/ciphers/vigenereCipher.js`)
- Schlüsselwort-basiert (`supportsKey: true`), Schlüssel wird auf Buchstaben normalisiert.
- Unterstützt optionalen Schlüssellängen-Hinweis fürs Knacken (`supportsCrackLengthHint: true`).
- Knacken kombiniert:
  - Schlüssellängen-Kandidaten (inkl. IoC-basierter Vorauswahl),
  - spaltenweise Shift-Rangfolge (Chi-Quadrat),
  - lokale Verbesserung per Search-Schritt,
  - Sprach-Scoring und Kandidaten-Ranking.
- `crack(...)` liefert besten Treffer plus Kandidatenliste.

## 8) Scoring- und Kandidatenbewertung (N-Gramme + Wörterbuch-Reranking)

Status: Dynamisch (periodisch aktualisieren)

Hinweis: Dieser Abschnitt dokumentiert die aktuelle Bewertungslogik als Arbeitskontext. Anpassungen sind erlaubt, wenn sie die Ergebnisqualität verbessern und mit den Kernprinzipien vereinbar sind.

### Lokales Sprach-Scoring in den Ciphern
- Cäsar bewertet Kandidaten mit einer Kombination aus:
  - Treffer auf häufige Wörter,
  - Bigramm-/Trigramm-Treffern,
  - Buchstabenverteilungs-Check (Chi-Quadrat),
  - Vokalverhältnis und Leerzeichenverteilung.
- Vigenère nutzt ein ähnliches Sprach-Scoring und kombiniert es mit der Schlüsselkandidaten-Suche.
- Leetspeak nutzt Übergangs-Scoring in der Beam-Search plus Sprach-Scoring auf dem erzeugten Klartext.

### Kandidatenfluss in `app.js`
- `crack(...)` liefert einen besten Kandidaten und optional weitere Kandidaten.
- Kandidaten werden normalisiert und absteigend nach Confidence sortiert.
- Danach erfolgt optional ein Wörterbuch-Reranking über `dictionaryScorer`.

### Wörterbuch-Reranking (`js/core/dictionaryScorer.js`)
- Prüft Wörter aus Kandidatentexten (normalisiert, dedupliziert, begrenzt auf eine kleine Menge pro Kandidat).
- Kombiniert:
  - API-Prüfung über `dictionaryapi.dev` (Sprachhinweise `de`, `en`, Timeout, Cache),
  - lokales Lexikon-Fallback.
- Verwendet ein kombiniertes Ranking:
  - ursprünglicher Cipher-Score (abgewichtet),
  - Wörterbuch-Abdeckung,
  - Bonus für erkannte Wörter,
  - Malus bei 0 erkannten Wörtern trotz ausreichender Wortanzahl.
- Ziel: Kandidaten mit realen Wörtern gegenüber rein heuristisch guten, aber sinnlosen Texten bevorzugen.

### Darstellung im UI
- Es werden Top-Kandidaten mit Schlüssel, Score und Wörterbuch-Abdeckung angezeigt.
- Bei fehlender Wörterbuch-Abdeckung gibt die UI einen Hinweis (inkl. Schlüssellängen-Tipp bei Vigenère).

## 9) Debuggingmethoden, Tooling und Nutzfälle

Status: Dynamisch (periodisch aktualisieren)

Hinweis: Dieser Abschnitt ist Kontextdokumentation für Analyse und Fehlersuche, keine starre Programmieranweisung.

### Technischer Rahmen (Bezug für Debugging)
- Laufzeit: Browser-App ohne externe JS-Bibliotheken und ohne Build-Tooling.
- Browser-APIs im Einsatz: `File/file.text()`, `fetch`, `navigator.clipboard` (mit `document.execCommand("copy")` als Fallback).
- Externer Dienst: `dictionaryapi.dev` für Wörterbuch-Reranking.
- Fallback bei externer Nichtverfügbarkeit: lokales Lexikon in `js/core/dictionaryScorer.js`.
- Entwicklungswerkzeug: Node.js für lokale Syntax-/Plausibilitätschecks (z. B. `node --check`).
- Projektstand: kein `package.json`, keine npm-Abhängigkeiten.

### Debuggingmethoden und typische Nutzfälle
- Reproduktions-Check: gleiche Eingabe, gleicher Modus, gleiche Schlüsselparameter.
  Nutzfall: Fehler eindeutig und stabil nachstellen.
- Input-/Output-Nachverfolgung: Rohinput, geparsten Text und Ausgabe getrennt prüfen.
  Nutzfall: Ursache zwischen Parsing, Cipher-Logik und UI-Ausgabe eingrenzen.
- Parser-Diagnose: Dateityp-Erkennung, Extraktionsheuristik und Fallback-Verhalten validieren.
  Nutzfall: Unerwartete Dateiimporte (JSON/JS/strukturierte Inputs) nachvollziehen.
- Cipher-Isolation: `encrypt/decrypt/crack` je Verfahren separat prüfen.
  Nutzfall: Verfahrenslogik unabhängig von Parser/UI testen.
- Kandidaten-Analyse: Schlüssel, Confidence und Wörterbuchabdeckung gemeinsam auswerten.
  Nutzfall: Unplausible Top-Treffer und Ranking-Fehlgewichtungen erkennen.
- API/Fallback-Abgleich: Ergebnisse mit verfügbarer API vs. lokalem Fallback vergleichen.
  Nutzfall: Unterschiedliche Resultate durch Netzwerk-/Dienststatus erklären.
- Regressions-Check: feste Testbeispiele vor/nach Änderungen vergleichen.
  Nutzfall: Sicherstellen, dass Fixes keine bestehenden Funktionen verschlechtern.

## 10) Betrieb und Start-Hinweise

Status: Dynamisch (periodisch aktualisieren)

Hinweis: Dieser Abschnitt beschreibt den aktuellen Betriebsstand und soll bei Änderungen an Start-/Ladeverhalten mitgepflegt werden.

- Aktueller Startmodus: Browser lädt `index.html` mit klassischen `<script src="...">`-Einbindungen (kein `type="module"`).
- Empfohlene Reihenfolge der Skripte: Core-Module, Cipher-Module, dann `js/app.js`.
- Bei neuen Verfahren: neue Cipher-Datei in `index.html` vor `js/app.js` einbinden.
- Unterstützte Eingabedateien laut UI/Parser: TXT, JSON, CSV, LOG, MD, JS/MJS/CJS.
- Externe Netzabhängigkeit zur Laufzeit: Wörterbuchprüfung über `dictionaryapi.dev`; bei Ausfall greift lokales Lexikon-Fallback.
- Node.js ist aktuell optional und dient der Entwicklung/Prüfung (z. B. Syntaxchecks), nicht als Browser-Laufzeitabhängigkeit.
- Minimaler Start-Check nach Änderungen:
  1. Dropdown enthält verfügbare Verfahren.
  2. Datei-Upload übernimmt den erwarteten Eingabetext.
  3. Ver-/Entschlüsselung läuft in beiden Modi.
  4. Kandidatenliste erscheint beim Knacken.
  5. Kopierfunktion liefert Ausgabe in die Zwischenablage.

## 11) Do/Don’t für Folge-Sessions

Status: Dynamisch (periodisch aktualisieren)

Hinweis: Dieser Abschnitt beschreibt Arbeitsregeln für die Zusammenarbeit über mehrere Sessions. Er ist Leitlinie, keine starre Programmieranweisung.

### Do
- Vor Änderungen zuerst `AGENTS.md` lesen und betroffene Abschnitte identifizieren.
- Dynamische Abschnitte bei relevanten Codeänderungen zeitnah mitpflegen.
- Bei neuen/veränderten Verfahren die relevanten Abschnitte konsistent aktualisieren (`2`, `3`, `4`, `6`, `7`, `8`, `9`, `10`).
- Änderungen an Dokumentationseinträgen vor dem Eintragen als Vorschlag mit Punktnummer, Titel und Volltext zur Freigabe zeigen (wenn vom Nutzer so gewünscht).
- Aussagen über den Ist-Stand auf Code und nachvollziehbare Session-Informationen stützen.
- Bei Unsicherheiten transparent machen, was bestätigt ist und was nur Annahme wäre.

### Don’t
- Keine Inhalte erfinden oder als „implementiert“ dokumentieren, wenn sie im Code nicht vorhanden sind.
- Projektziele/Kernprinzipien (`1`) oder den Architekturgrundsatz in `3` ohne explizite Freigabe ändern.
- Redundante Aufzählungen pflegen, die bereits direkt über Dateistruktur/Code ersichtlich sind.
- Problemkataloge zu eng auf momentane Einzelfehler zuschneiden; methodische, langfristig nutzbare Hinweise bevorzugen.
- Session-spezifische Zwischenabsprachen dauerhaft als allgemeingültige Produktregeln dokumentieren.
