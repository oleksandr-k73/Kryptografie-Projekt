Du implementierst die Aktualisierung gemäß dem Plan unter docs/plans/skillPatch1/PLAN.md.

Arbeite strikt in dieser Reihenfolge:
1) `scripts/docs/benchmark_context_tokens.mjs` anpassen: Default `maxTotalTokens` auf `10350`. Keine weiteren Logikänderungen.
2) `skills/cipher-new-method/SKILL.md` aktualisieren:
   - Script‑Reihenfolge ergänzen:
     - Core‑Module vor Cipher‑Modulen.
     - `js/core/segmentLexiconData.js` vor `js/core/dictionaryScorer.js`.
     - Cipher‑Script vor `js/app.js`.
   - UI‑/Integrations‑Flags ergänzen:
     `supportsAlphabet`, `defaultAlphabet`, `alphabetLabel`, `alphabetPlaceholder`, `normalizeAlphabet`,
     `supportsMatrixKey`, `reuseKeyForCrackHint`, `info.note`.
   - Keine Wiederholung der AGENTS‑Regeln zu Kommentarpflicht/Umlauten.
   - Pflichtbegriffe müssen im Skill‑Korpus enthalten bleiben:
     `Cipher-Vertrag`, `Crack-Rückgabeform`, `Dictionary-Reranking`, `Fallback`, `CipherRegistry.register`,
     `index.html`, `js/app.js`, `Input-/Output-Nachverfolgung`, `parseInputFile`, `debug-checklist`.
3) Optional `skills/cipher-new-method/agents/openai.yaml` minimal ergänzen, Doku‑Reihenfolge im `default_prompt` beibehalten.

Danach Tests ausführen:
- `pnpm run test:node`
- `pnpm run test:vitest`
- `pnpm run test:gates`

Am Ende berichten:
- Geänderte Dateien.
- Kurzcheck: Pflichtbegriffe weiterhin vorhanden.
- Test‑Ergebnisse (pass/fail).