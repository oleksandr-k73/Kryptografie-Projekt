## Plan: Markdown-Aktualisierungen zu `fileParsers`-Bugfixes + Teststabilisierung

### Summary
Wir aktualisieren nur die relevanten Markdown-Dateien außerhalb `docs/plans`, damit die bereits umgesetzten Bugfixes und Stabilitätsmaßnahmen dokumentiert sind, ohne neue Funktionalität einzuführen.

### Public APIs / Interfaces / Types
Keine Änderungen an öffentlichen APIs, Interfaces oder Verträgen.  
Nur Dokumentation wird angepasst.

### Geplante Markdown-Änderungen mit Vorschau

1. Datei: [docs/DATENFLUSS.md](/home/mrphaot/Dokumente/Kryptografie-Projekt/docs/DATENFLUSS.md)  
Abschnitt `3. Dateiparsing` um die zwei bestätigten Parser-Bugfixes ergänzen.

**Vorschau (neu einzufügende Bulletpoints):**
```md
- JS-Parser bewertet reine Literal-Fallback-Kandidaten neutral über den Pfad `_literal`,
  damit starke Schlüssel wie `value` nur bei echten Key-Signalen aus Assignment/Property wirken.
- CSV-Textspaltenwahl nutzt exakte Header-Tokens (Delimiter: `_`, Leerzeichen, `-`) statt Substring-Matching;
  so werden False Positives wie `metadata` -> `data` vermieden, während `cipher_text` weiter erkannt wird.
```

2. Datei: [docs/SCORING.md](/home/mrphaot/Dokumente/Kryptografie-Projekt/docs/SCORING.md)  
Kurze Ergänzung im Bereich Scoring-Grenzen/Nebenwirkungen, dass Parser-Vorpriorisierung nicht mit Cipher-/Dictionary-Scoring verwechselt wird.

**Vorschau (kompakter Zusatzabschnitt):**
```md
## 6) Parser-Vorpriorisierung (Dateiimport)

- Bei JS-Importen werden Kandidaten weiterhin über Key-Pfade gewichtet; reine Literal-Fallbacks bleiben neutral (`_literal`).
- Bei CSV-Importen erfolgt die Erkennung der Textspalte über exakte Header-Tokens statt über Teilwort-Treffer.
- Diese Vorpriorisierung betrifft nur die Textextraktion aus Dateien und ändert nicht das Cipher- oder Wörterbuch-Scoring.
```

3. Datei: [AGENTS.md](/home/mrphaot/Dokumente/Kryptografie-Projekt/AGENTS.md)  
Debugging-Playbook minimal ergänzen, damit zukünftige Agenten die zwei Fix-Schwerpunkte direkt prüfen.

**Vorschau (Ergänzung unter `## 6) Debugging-Playbook`):**
```md
- JS-Parser-Regression prüfen: Literal-Fallback muss neutral (`_literal`) bleiben; Assignment-/Property-Keys dürfen nicht durch künstlichen `value`-Bonus übersteuert werden.
- CSV-Spaltenwahl prüfen: Header-Tokens werden exakt gegen starke Textschlüssel gematcht (`_`, Leerzeichen, `-`), um Substring-Fehlgriffe wie `metadata` -> `data` zu vermeiden.
```

### Umsetzungsschritte
1. `docs/DATENFLUSS.md` patchen (Parserfluss).
2. `docs/SCORING.md` patchen (Abgrenzung Parser vs. Scoring).
3. `AGENTS.md` patchen (Debugging-Playbook).
4. Konsistenz-Check auf Umlaute, Terminologie und Stil.
5. Verifikation laufen lassen.

### Test Cases / Verifikation
1. `node --test tests/docs/*.test.mjs`
2. `node scripts/docs/run_quality_gates.mjs --iterations 25`

### Assumptions / Defaults
1. Es werden nur `AGENTS.md`, `docs/DATENFLUSS.md`, `docs/SCORING.md` geändert.
2. Keine Änderungen unter `docs/plans`.
3. Formulierungen bleiben deutschsprachig mit Umlauten und „Warum“-Fokus.
4. Keine Code- oder Testlogikänderung im Zuge dieser Doku-Aktualisierung.
