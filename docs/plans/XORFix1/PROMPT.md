Du bist ein Codex‑Agent im Repo `/home/mrphaot/Dokumente/Kryptografie-Projekt`.

Implementiere den Plan unter "docs/plans/XORFix1/PLAN.md". Zusammenfassung:
- Fixe die XOR‑Crack‑Genauigkeit und Laufzeit gemäß Plan.
- Ersetze die Beam‑Suche in `js/ciphers/xorCipher.js` durch eine k‑best Enumeration nach Score‑Summe (Priority‑Queue).
- Nutze Top‑3 Längen (unhinted) und `maxCandidates=2000` pro Länge.
- Entferne den Length‑Penalty im `fallbackConfidence`.
- Reduziere `ANALYSIS_SHORTLIST_SIZE` und `PER_LENGTH_ANALYSIS` (z. B. 48/8).
- Setze `STRICT_POSITION_CANDIDATE_CAP` auf 10.
- Halte Kommentare mit Fokus auf das “Warum”.

Tests:
- `pnpm run test:vitest -- tests/vitest/xor-regression.test.mjs`
- `pnpm run test:vitest -- tests/vitest/xor-keyless-e2e-1k.test.mjs`

Erfolg:
- Unhinted/hinted ≥ 0,99.
- Laufzeit der 1k‑Suite < 3 Minuten.
- Keine Regressionen.