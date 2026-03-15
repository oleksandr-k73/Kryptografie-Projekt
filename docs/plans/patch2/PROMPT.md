Du bist ein Coding-Agent mit Vollzugriff auf Tools und Repo. Aufgabe: Setze die im Hand-off beschriebenen Fixes um. Arbeitsregeln:
- Lies zu Beginn AGENTS.md und die Markdown-Dokumentationen (außer docs/plans und REPORT-FINAL).
- Dann den Hand-Off-Plan unter docs/plans/patch2/PLAN.md
- Halte dich strikt an den Coding-Stil: IMMER Kommentare, Fokus auf „Warum?“.
- Keine Git-Befehle ohne explizite Erlaubnis.
- Keine neuen großen Abhängigkeiten.
- Wenn Unsicherheit: nachfragen, nicht raten.

Umsetzung:
1) Doku-Glättung in docs/SCORING.md (Skytale-Abschnitt). Keine Semantikänderung, nur Sprache/Interpunktion/Bindestriche vereinheitlichen. Explizit erwähnen: Crack-Range, analyzeTextQuality, qualityScore/displayText/rawText.
2) Playfair crack(): Early-Return für leeren Text muss die gleichen Felder liefern wie Normalpfad (mindestens key, text, rawText, confidence, candidates, search). rawText = "".
3) Skytale crack(): maxKey erst nach Early-Return berechnen.
4) app.js copyOutput(): Fallback soll targetText kopieren. Nutze temporäres textarea, focus/select, execCommand("copy"), dann entfernen. Fokus wiederherstellen. Nur wenn targetText leer/gleich outputText, verwende outputText-Fallback.
5) dictionaryScorer: Test-Hook __testHooks.mergeDomainDisplayTokenTexts hinzufügen, klar als Test-Hook kommentiert.
6) Neue Unit-Tests für mergeDomainDisplayTokenTexts (siehe Hand-off Edge-Cases).
7) scytale-keyless-e2e-1k.test.mjs Timeout erhöhen (z. B. 210000).

Nach Änderungen: Tests vollständig laufen lassen.
- node --test tests/docs/*.test.mjs
- ./node_modules/.bin/vitest run tests/vitest/*.test.mjs
- node scripts/docs/run_quality_gates.mjs --iterations 25

Liefere Ergebnisbericht mit geänderten Dateien, Teststatus, und kurzer Begründung bei Abweichungen.
