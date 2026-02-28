## 1) Projektüberblick

Dieses Projekt ist eine browserbasierte Kryptografie-Werkbank (HTML + Vanilla JS).  
Texte werden aus manueller Eingabe oder aus Dateien verarbeitet. Ziel ist, mehrere Verschlüsselungsverfahren zu ver- und entschlüsseln und im Entschlüsselungsmodus ohne Schlüssel automatisches Knacken zu unterstützen.

Der Fokus liegt auf:
- Erweitbarkeit (z. B. Cipher-Architektur)
- Robustheit (z. B. mehrere Dateiformate)

## 2) Technischer Rahmen

- Derzeit:
  - Laufzeit bleibt browserbasiert ohne Build-Tooling (klassische `<script>`-Einbindung)
  - Node-basierte Qualitäts-/Benchmark-Suite über `pnpm` + `package.json`
  - Dev-Dependencies für Test/Analyse: `vitest`, `fast-glob`, `unified`, `remark-parse`, `remark-frontmatter`, `gpt-tokenizer`, `tinybench`, `yaml`
- Browser-APIs:
  - `File/file.text()`
  - `fetch`
  - `navigator.clipboard` mit Fallback `document.execCommand("copy")`
- Externer Dienst:
  - `dictionaryapi.dev` für Wörterbuch-Reranking
- Fallback:
  - lokales Lexikon in `js/core/dictionaryScorer.js`
- Lokale Checks:
  - Node.js für Syntax-/Plausibilitätschecks (z. B. `node --check`)
  - reproduzierbare Gate-Läufe über `pnpm run test` und `pnpm run test:gates`
  - keine Browser-Laufzeitabhängigkeit

## 3) Projektstruktur

### Einstieg und UI
- `index.html`: UI-Struktur, Eingabefelder, Infobox, Script-Reihenfolge
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
- alle Cipher-Dateien liegen in `js/ciphers/` (z. B. `caesarCipher.js`)
- Cipher-spezifische Details: `js/ciphers/AGENTS.md`

### Orchestrierung
- `js/app.js`
  - Initialisierung, Event-Wiring, Datei-Handling, Moduslogik
  - UI-Zustand (Schlüsselfeld, Schlüssellänge, Status, Kandidatenanzeige)
  - Aufruf der Crack-Funktion + optionales Dictionary-Reranking

## 4) Arbeitsregeln

### Hinweise
- Startmodus: Browser lädt `index.html` mit klassischen `<script src="...">`-Einbindungen (kein `type="module"`).
- Empfohlene Script-Reihenfolge: Core-Module, Cipher-Module, dann `js/app.js`.
- Bei Anzeigetexten immer Umlaute verwenden (`Verschlüsselung` statt `Verschluesselung`).
- Nach umfangreichen Codeänderungen Markdown-Dokumentationen aktualisieren (`AGENTS.md`, `docs/DATENFLUSS.md`, `docs/SCORING.md`; keine Skills).
- Best-Practices für Doku-Qualität:
  - https://www.aihero.dev/a-complete-guide-to-agents-md
  - https://github.com/agentsmd/agents.md/issues/135
- Bei Unsicherheit: zuerst dieses `AGENTS.md` lesen, dann nachfragen (nichts annehmen).

### Coding-Stil
- Kommentare primär mit dem Fokus auf das „Warum?“.
- „Was?“-Kommentare nur dort, wo Verhalten sonst nicht ersichtlich ist.
- Schlecht: `// parse key`
  Besser: `// Schlüssel wird früh validiert, damit Eingabefehler als klare UI-Meldung enden statt später als schwer lokalisierbarer Laufzeitfehler.`
- Schlecht: `// fallback bei api-fehler`
  Besser: `// Bei API-Ausfall bleibt lokales Ranking aktiv; so bleibt Entschlüsselung deterministisch verfügbar und externes Flattern blockiert den Workflow nicht.`

### Beschränkungen
- Keine Git-Befehle ohne Zulassung.
- Skills nur auf explizite Anweisung ändern.
- Keine großen Bibliotheken/Abhängigkeiten ohne Absprache hinzufügen.

## 5) Dokumentationslandkarte

- Laufzeitfluss und Fallbacks: `docs/DATENFLUSS.md`
- Scoring und Kandidaten-Ranking: `docs/SCORING.md`
- Cipher-spezifische Verträge und Besonderheiten: `js/ciphers/AGENTS.md`

## 6) Debugging-Playbook

- Bei neuen/angepassten Verfahren die zugehörige Anleitung aus dem Skill befolgen.
- Regressions-Check: feste Testbeispiele vor/nach Änderungen vergleichen.
- Input-/Output-Nachverfolgung: Rohinput, geparster Text und Ausgabe getrennt prüfen.
- Parser-Diagnose: Dateityp-Erkennung, Extraktionsheuristik und Fallback-Verhalten validieren.
