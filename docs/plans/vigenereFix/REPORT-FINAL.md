# Final Report — Vigenère Optimizations & Benchmarks

Datum: 1. März 2026

Kurzfassung
- Implementierte reversible, feature-flag-gestützte Optimierungen in `js/ciphers/vigenereCipher.js`: `memoChi`, `incrementalScoring` (scaffolding), `localSearchK` (top‑K proposals), `progressiveWidening`, `collectStats`.
- Wörterbuch-Reranking (`js/core/dictionaryScorer.js`) wurde lokal-first umgesetzt: eine kurze API-Probe entscheidet über Online-Validierungen; Online-Checks laufen nur für eine kleine Top‑K der lokal bewerteten Kandidaten.
- Reproduzierbare Benchmarks (seed=42) wurden durchgeführt: Stage A (n=100) und Stage B (n=1000). Artefakte gespeichert unter `tests/vitest/fixtures/bench-results/`.

Wesentliche Ergebnisse
- Stage A (n=100): hinted avg ≈ 1.659 ms, unhinted avg ≈ 3408.72 ms, overall avg ≈ 1705.19 ms.
- Stage B (n=1000): hinted avg ≈ 1.619 ms, unhinted avg ≈ 3454.704 ms, overall avg ≈ 1728.161 ms (total ≈ 0.96 h).
- Erfolgsrate (Test-Hypothese: Normalized plaintext recovery): 100% in den durchgeführten Läufen (lokale Test-Suite: `pnpm run test`).

Änderungen im Code (Kurz)
- `js/ciphers/vigenereCipher.js`: Optimierungsflags, Chi-Memoisierung, top‑K lokale Verfeinerung, bounded exhaustive fallback für sehr kurze, hint-gestützte Schlüssel, Telemetrie-Punkt `result.search.telemetry` (optional).
- `js/core/dictionaryScorer.js`: Lokales Scoring für alle Kandidaten, `probeDictionaryApi()` für schnelle Erreichbarkeitsprüfung, Online-Checks nur für Top‑K Kandidaten, deterministisches Fallback bei API-Ausfall.

Artefakte
- `tests/vitest/fixtures/bench-results/stageA.json`
- `tests/vitest/fixtures/bench-results/stageB.json`
- `tests/vitest/fixtures/bench-results/RESULTS.md`

Empfehlungen / Nächste Schritte
- Für produktive/Batch-Runs: wenn möglich `keyLength`-Hints bereitstellen oder unhinted-Läufe asynchron in Background-Jobs ausführen.
- Optional: weiteres Tuning der `localSearchK` und `evaluationBudget` zur Reduktion der unhinted-P95-Tails.
- Optional: Analytics‑Rollback prüfen, `collectStats` anpassen, und ggf. Telemetrie-Reduktion bei hoher Last.

Kontakt
- Änderungen sind in `js/ciphers/vigenereCipher.js` und `js/core/dictionaryScorer.js` implementiert. Fragen oder Review-Wünsche? Ich übernehme gern nächste Feineinstellungen.
