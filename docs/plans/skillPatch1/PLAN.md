**Plan: Skill‑Aktualisierung + Token‑Gate‑Anhebung**

**Summary**
- Aktualisiert den Skill `cipher-new-method` um fehlende, repo‑relevante Integrationsdetails (Script‑Reihenfolge und optionale UI‑Flags).
- Hebt das Kontext‑Tokenbudget im Benchmark‑Script auf `10350` an.
- Plan ist als Hand‑Off für eine separate Implementierungs‑Session ausgelegt.

**Implementation Changes**
1. `scripts/docs/benchmark_context_tokens.mjs`
- Setze den Default von `maxTotalTokens` von `10250` auf `10350`.
- Keine weiteren Logikänderungen.

2. `skills/cipher-new-method/SKILL.md`
- Ergänze einen präzisen Hinweis zur Script‑Reihenfolge:
  - Core‑Module vor Cipher‑Modulen.
  - `js/core/segmentLexiconData.js` vor `js/core/dictionaryScorer.js`.
  - Cipher‑Script vor `js/app.js`.
- Ergänze eine kurze, allgemeine Sektion zu optionalen UI‑/Integrations‑Flags:
  - `supportsAlphabet`, `defaultAlphabet`, `alphabetLabel`, `alphabetPlaceholder`, `normalizeAlphabet`
  - `supportsMatrixKey`
  - `reuseKeyForCrackHint`
  - `info.note`
- Vermeide Wiederholungen zu Kommentarpflicht und Umlauten (stehen bereits in `AGENTS.md`).
- Stelle sicher, dass die Pflichtbegriffe weiterhin im Skill‑Korpus vorhanden bleiben:
  - `Cipher-Vertrag`, `Crack-Rückgabeform`, `Dictionary-Reranking`, `Fallback`, `CipherRegistry.register`,
  - `index.html`, `js/app.js`, `Input-/Output-Nachverfolgung`, `parseInputFile`, `debug-checklist`.

3. `skills/cipher-new-method/agents/openai.yaml`
- Optional: Ergänze eine kurze Erwähnung der Script‑Order/Optional‑Flags.
- Doku‑Reihenfolge im `default_prompt` muss unverändert und in exakt der geforderten Reihenfolge enthalten bleiben.

**Test Plan**
1. `pnpm run test:node`
2. `pnpm run test:vitest`
3. `pnpm run test:gates`

**Abgabekriterien**
- `benchmark_context_tokens` bleibt unter `maxTotalTokens=10350`.
- `skills/cipher-new-method/SKILL.md` enthält die neue Script‑Order‑Regel und die UI‑Flag‑Sektion, ohne AGENTS‑Regeln zu duplizieren.
- `tests/docs/skill-alignment.test.mjs` bleibt grün.
- Alle Tests aus dem Test Plan sind grün.

**Assumptions**
- Plan wird auf Wunsch trotz aktuell rotem Gate geliefert; Behebung erfolgt in der Implementierungsphase.
