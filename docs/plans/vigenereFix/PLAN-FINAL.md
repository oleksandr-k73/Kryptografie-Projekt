**PLAN: Vigenere-Fix Final**

TL;DR — Ziel ist ein regressionssicherer, reversibler Satz Optimierungen für `vigenereCipher` (memoization, inkrementelles Scoring, Top‑K‑LocalSearch, progressive widening) plus seeded 10k-Datensatz, Microbenches und gestufte Messpipeline (Stage A→D). Alle Änderungen sind feature‑flagged (`options.optimizations`) und müssen BRICK‑Regression sowie Kurztext‑Rescue in beiden Modi (mit/ohne `keyLength` hint) sicherstellen. Endprodukt: `tests/vitest/fixtures/bench-results/stageD.json` (Seeded, reproduzierbar), Dokumentation und `REPORT-FINAL.md`.

Steps
1. Gate & Docs
   - Prüfe AGENTS.md (AGENTS.md) auf Docs‑Gate-Probleme und ensure `pnpm run test:gates` läuft grün.
2. Core optimizations (must be feature-flagged)
   - File: vigenereCipher.js
   - Add `DEFAULT_OPTIMIZATION_FLAGS` and accept `options.optimizations`.
   - Implement `memoChi` (cache per column fingerprint + shift) used by `rankedShiftsForColumn` / `chiSquaredForShift`.
   - Add `incrementalScoring` scaffolding: per-column decoded caches and `scoreDeltaForShiftChange(state,pos,newShift)` to allow local deltas in `refineByLocalSearch`.
   - Replace exhaustive 26-shift local trials with `localSearchK` proposals (default K=3 when enabled). Early-stop on marginal improvements.
   - Add `progressiveWidening` in `expandStatesWithBudget`: expand top-N first, compute lightweight partial-chi pruning before heap insertion.
   - Add `collectStats` telemetry (timers/counters) emitted in returned `search` object.
   - All changes must include comments explaining rationale.
3. Seeded dataset & benches (already created per interim report; verify)
   - Files: vigenereDataset.js, chi_and_local_search.js, run_bench.js.
   - Ensure generator implements LCG seed, bucket quotas (30% short / 40% mid / 30% long) and key‑relation distribution (50% key < text, 30% key > text/2, 20% key == text).
4. Tests
   - Update vigenere-regression.test.mjs to assert BRICK regression in both hinted (`options.keyLength`) and unhinted modes.
   - Ensure APCZX short-text rescue test present and passing.
   - Allow tests to toggle `options.optimizations` to assert behavior in both modes.
5. Bench pipeline & artifacts
   - Use run_bench.js to run staged suites and write JSON+MD to bench-results.
   - Stages:
     - A: n=100 (sanity)
     - B: n=1_000 (stability)
     - C: n=5_000 (scale)
     - D: n=10_000 (final)
6. Tuning loop
   - If Stage C or D misses time/success goals, iterate adjustments: turn on `memoChi`, increase `localSearchK`, relax progressive pruning, adjust `stateBudget`/`evaluationBudget` heuristics. Re-run Stage A→C after each tuning.
7. Documentation & Handoff
   - Add `REPORT-FINAL.md` under vigenereFix describing machine spec, flags used, final Stage D results and how to reproduce.
   - Update AGENTS.md to reflect new `options.optimizations` contract.

Verification (commands)
- Run unit & gates:
```bash
pnpm install
pnpm run test
pnpm run test:gates
```
- Stage A (sanity):
```bash
node tests/vitest/run_bench.js --seed 42 --n 100 --optimizations true --out tests/vitest/fixtures/bench-results/stageA.json
```
- Stage B (stability):
```bash
node tests/vitest/run_bench.js --seed 42 --n 1000 --optimizations true --out tests/vitest/fixtures/bench-results/stageB.json
```
- Stage C/D after tuning:
```bash
node tests/vitest/run_bench.js --seed 42 --n 5000 --optimizations true --out tests/vitest/fixtures/bench-results/stageC.json
node tests/vitest/run_bench.js --seed 42 --n 10000 --optimizations true --out tests/vitest/fixtures/bench-results/stageD.json
```

JSON output schema (required fields)
- `seed` (int)
- `n` (int)
- `flags` (object)
- `avgMs`, `p50`, `p95` (numbers)
- `totalMs`, `totalHours` (numbers)
- `successRate` (0..1), `successCount` (int)
- `statesGenerated`, `statesEvaluated`, `optionCount` (ints)
- `notes` (string)

Acceptance criteria for handoff
1. All listed optimizations implemented and feature-flagged; explanatory comments included.
2. `pnpm run test` and `pnpm run test:gates` pass.
3. Stage A & B JSON artifacts present in bench-results.
4. Final Stage D run (seeded) produces `totalHours <= 2.5` on the local dev machine and `successRate >= 0.80` for both hinted and unhinted modes. If not achievable, deliver a tuning summary explaining remaining delta and further actions.
5. BRICK regression and APCZX short-text rescue tests green in both optimized and non-optimized modes.

Decisions
- Implement optimizations behind `options.optimizations`.
- Use seeded LCG dataset generator for reproducibility.
- Target is the local dev machine; record its CPU/memory in `REPORT-FINAL.md`.
- No new external dependencies unless explicitly approved.

