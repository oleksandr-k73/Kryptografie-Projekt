# PLANS.md — Endgültiger Implementierungsplan für Doku-, Skill- und Testmodernisierung

## Kurzfassung
Dieser Plan führt eine vollständige, schrittweise Modernisierung der Markdown-Dokumentation durch, synchronisiert danach den Skill `skills/cipher-new-method`, und etabliert automatisierte Qualitäts- und Performance-Gates (inkl. Token-/Context-Messung).  
Die Reihenfolge ist strikt: **Core-Markdowns → Coding-Stil in AGENTS.md → Skill-Update → Tests/Benchmarks → Iterationsschleife bis Plateau**.

## Verbindlicher Scope

### Zu bearbeiten (Startsatz für Verbesserungs-Schleife)
1. `/home/mrphaot/Dokumente/Kryptografie-Projekt/AGENTS.md`
   - Vorgenerierte, verbesserte Variante: `/home/mrphaot/Dokumente/Kryptografie-Projekt/docs/plans/docsMarkdown/AGENTS-PLAN.md`
2. `/home/mrphaot/Dokumente/Kryptografie-Projekt/docs/DATENFLUSS.md`
   - Vorgenerierte, verbesserte Variante: `/home/mrphaot/Dokumente/Kryptografie-Projekt/docs/plans/docsMarkdown/DATENFLUSS-PLAN.md`
3. `/home/mrphaot/Dokumente/Kryptografie-Projekt/docs/SCORING.md`
   - Vorgenerierte, verbesserte Variante: `/home/mrphaot/Dokumente/Kryptografie-Projekt/docs/plans/docsMarkdown/SCORING-PLAN.md`
4. `/home/mrphaot/Dokumente/Kryptografie-Projekt/js/ciphers/AGENTS.md`
   - Vorgenerierte, verbesserte Variante: `/home/mrphaot/Dokumente/Kryptografie-Projekt/docs/plans/docsMarkdown/js/ciphers/AGENTS-PLAN.md`

### Danach (nachgelagert, erst nach Core-Markdowns)
1. `/home/mrphaot/Dokumente/Kryptografie-Projekt/skills/cipher-new-method/SKILL.md`
2. `/home/mrphaot/Dokumente/Kryptografie-Projekt/skills/cipher-new-method/references/debug-checklist.md`
3. `/home/mrphaot/Dokumente/Kryptografie-Projekt/skills/cipher-new-method/agents/openai.yaml`

### Ausgeschlossen
1. Alles unter `/home/mrphaot/Dokumente/Kryptografie-Projekt/docs/plans/`
2. Alle anderen Skill-Verzeichnisse außer `skills/cipher-new-method`

---

## Phase 0 — Baseline, Metriken, Entscheidungssicherheit
1. Baseline der oben genannten Dateien erfassen (Inhalt, Struktur, interne Links, Frontmatter).
2. Baseline-Metriken erfassen:
   - Dateigröße/Wortanzahl/Token-Schätzung
   - Redundanz zwischen Root- und Detaildokus
   - Anzahl unklarer/inkonsistenter Regeln
3. Konsistenzquelle festlegen:
   - Primär `js/app.js`, `js/core/*`, `js/ciphers/*` als Implementierungs-Truth.
   - Dokumentation wird daran abgeglichen.
4. Guardrail:
   - Überblicksinformationen in `AGENTS.md` müssen vollständig erhalten bleiben (nur präziser strukturiert).

## Phase 1 — Core-Markdowns korrigieren (ohne Skill-Änderung)
1. `AGENTS.md` in klare Agenten-Sektionen bringen:
   - Projektüberblick
   - Technischer Rahmen
   - Arbeitsregeln/Beschränkungen
   - Dokumentationslandkarte (progressive disclosure)
   - Debugging-Playbook
2. `docs/DATENFLUSS.md` auf tatsächlichen Laufzeitpfad normieren:
   - Init, Input-Pfade, Parser-Heuristik/Fallbacks, Encrypt/Decrypt/Crack, Reranking, UI-Status, Copy-Fallback.
3. `docs/SCORING.md` an reale Scoring-/Rankinglogik anpassen:
   - lokale Cipher-Heuristik
   - Dictionary-Reranking inkl. Gewichtungen/Penalties/Tie-Breaker
   - Grenzen bei kurzen Texten/API-Ausfall
4. `js/ciphers/AGENTS.md` als Cipher-Vertragsdoku schärfen:
   - Pflichtfelder, optionale Metadaten, Crack-Rückgabeform, Besonderheiten je Cipher.

## Phase 2 — `### Coding-Stil` in AGENTS.md schärfen (exakt 2 Beispiele)
Nur diese zwei Beispiele einbauen, um die Kernprinzipien abzudecken:

1. Schlecht: `// parse key`  
   Besser: `// Schlüssel wird früh validiert, damit Eingabefehler als klare UI-Meldung enden statt später als schwer lokalisierbarer Laufzeitfehler.`

2. Schlecht: `// fallback bei api-fehler`  
   Besser: `// Bei API-Ausfall bleibt lokales Ranking aktiv; so bleibt Entschlüsselung deterministisch verfügbar und externes Flattern blockiert den Workflow nicht.`

## Phase 3 — Skill-Synchronisierung (erst jetzt)
1. `SKILL.md` mit neuen Core-Regeln synchronisieren:
   - Lese-/Arbeitsreihenfolge erzwingen (`AGENTS.md` → `docs/*` → `js/ciphers/AGENTS.md`).
   - Terminologie und Vertragsbegriffe vereinheitlichen.
2. `references/debug-checklist.md` anpassen:
   - reproduzierbare Pass-Kriterien
   - klare Regression- und Fallback-Checks
   - konsistente Referenzen auf aktualisierte Dokus
3. `agents/openai.yaml`-Prompt nachschärfen:
   - Skill soll Doku-Gates und Reihenfolge aktiv einhalten.

## Phase 4 — Externe Abhängigkeiten für leistungsfähige Testgarnitur
### Vorbedingung
1. Paketmanager verfügbar machen (empfohlen `pnpm`; alternativ `npm`).
2. Wenn kein Paketmanager installierbar ist: Fallback auf pure Node-Tests (reduzierte Genauigkeit).

### Geplante Dependencies
1. `vitest` (schnelle, parallele Tests + gute Reporter)
2. `fast-glob` (performante Dateisuche)
3. `unified`, `remark-parse`, `remark-frontmatter` (AST-basierte Markdown-/Frontmatter-Prüfung)
4. `gpt-tokenizer` (robuste Tokenmessung)
5. `tinybench` (stabile Benchmark-Wiederholungen)
6. optional `yaml` (strenge Frontmatter-Validierung)

### Begründung
Diese Kombination erhöht Testgeschwindigkeit, Robustheit und Messqualität signifikant gegenüber rein regex-/fs-basierten Node-Skripten.

## Phase 5 — Automatisierte Prüf- und Benchmark-Suite
Neue Prüfpfade anlegen:
1. `scripts/docs/check_doc_contracts.*`
2. `scripts/docs/check_code_doc_consistency.*`
3. `scripts/docs/check_progressive_disclosure.*`
4. `scripts/docs/check_skill_alignment.*`
5. `scripts/docs/benchmark_context_tokens.*`
6. `tests/docs/fixtures/*`
7. `tests/docs/*.test.*`

Pflichtprüfungen:
1. Pflichtsektionen/Regeln je Markdown-Datei.
2. Konsistenz Doku ↔ Code (`app.js`, `core`, `ciphers`, Script-Reihenfolge).
3. Progressive Disclosure:
   - Root steuert
   - Details ausgelagert
   - Redundanz unter Schwellwert.
4. Skill-Alignment zu Core-Dokus.
5. Agent-Verhaltensszenarien (z. B. „neuen Cipher bauen“, „nur Parsing debuggen“).
6. Token-/Context-Benchmark vor/nach.

## Phase 6 — Verbesserungsschleife bis kein Mehrwert mehr entsteht
1. Baseline messen.
2. Änderungen umsetzen.
3. Vollständige Suite ausführen.
4. Nur Änderungen behalten, die Qualität/Performance verbessern.
5. Wiederholen bis Abbruchbedingung:
   - zwei Iterationen in Folge ohne relevante Verbesserung
   - alle Gates grün.

---

## Änderungen an öffentlichen APIs/Interfaces/Typen
1. Laufzeit-APIs der Web-App: keine verpflichtende Änderung.
2. Dokumentations-Interfaces: normierte Abschnittsverträge und klare Referenzkette.
3. Skill-Interface: präzisierte, verbindliche Workflow-Reihenfolge.
4. Test-Interface: neue reproduzierbare Doku-/Konsistenz-/Benchmark-Checks.

## Abnahmekriterien (Definition „grün“)
1. `AGENTS.md`-Überblick vollständig erhalten.
2. Alle Core-Markdowns fachlich korrekt zum aktuellen Code.
3. `Coding-Stil` enthält exakt 2 „Schlecht/Besser“-Beispiele.
4. Skill-Dateien widerspruchsfrei zu Core-Markdowns.
5. Alle automatisierten Checks bestanden.
6. Token-/Context-Metrik verbessert oder sauber als nicht weiter optimierbar belegt.

## Annahmen und Defaults
1. Sprache bleibt Deutsch.
2. Umlaute in UI-bezogenen Formulierungen bleiben korrekt.
3. Keine Änderung an `docs/plans/*`.
4. Externe Abhängigkeiten sind erlaubt, aber nur für Test-/Analysepfade.
5. Bei unauflösbarem Konflikt gilt Implementierungs-Truth aus dem Code.

---

## Implementierungs-Prompt für anderen Chat (einfach)
```text
Implementiere PLANS.md vollständig und strikt in der angegebenen Reihenfolge.
Arbeite dateibasiert und reproduzierbar:
1) Core-Markdowns aktualisieren (AGENTS.md, docs/DATENFLUSS.md, docs/SCORING.md, js/ciphers/AGENTS.md),
2) danach exakt zwei Schlecht/Besser-Beispiele im Abschnitt "### Coding-Stil" von AGENTS.md,
3) danach skills/cipher-new-method synchronisieren (SKILL.md, references/debug-checklist.md, agents/openai.yaml),
4) danach die geplante automatisierte Test- und Benchmark-Suite aufsetzen und ausführen,
5) anschließend iterativ verbessern bis alle Gates grün sind und zwei Iterationen keine relevante Verbesserung mehr zeigen.
Liefere am Ende: Diff-Zusammenfassung, Testergebnisse, Benchmark-Vergleich vor/nach, offene Risiken.
```

## Selbstprüfung dieses Plans (Anforderungsabgleich)
1. Detaillierte Phasenstruktur übernommen.
2. Exakte Markdown-Dateien als Startsatz enthalten.
3. Verbesserungen aus Dependency-/Test-Plan integriert.
4. Zwei (nicht mehr) Kommentarstil-Beispiele enthalten.
5. Implementierungsbereiter Prompt enthalten.
