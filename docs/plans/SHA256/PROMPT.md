You are implementing SHA‑256 in the Kryptografie‑Projekt (browser, vanilla JS). Follow the plan under "docs/plans/SHA256/PLAN.md". Summary:

- Hash raw UTF‑8 input as‑is, output uppercase 64‑HEX.
- Add `js/ciphers/sha256Cipher.js` with a sync SHA‑256 implementation (precomputed K constants, 32‑bit ops, typed arrays). Include comments that explain “why.”
- Cipher metadata: id `sha-256`, name `SHA-256`, supportsKey false, and info.note that Entschlüsselung ist WIP.
- `crack(text, options)` validates 64‑HEX input and matches against `options.candidates` (plaintext list). If match, return plaintext with high confidence. If no candidates or no match, return `{ search: { wip: true, wipMessage: "SHA‑256: Entschlüsselung ist Work in Progress (nur Kandidatenvergleich)." } }`.
- `decrypt(text)` throws a clear error explaining SHA‑256 is one‑way.
- Update `js/app.js` to detect `cracked.search.wip` and show the WIP status, skip ranking/candidates, and avoid implying success.
- Add SHA‑256 script include to `index.html` before `js/app.js`.
- Tests:
  - Add `tests/vitest/generators/sha256Dataset.js` (seeded RNG + Node crypto reference).
  - Add `tests/vitest/sha256-keyless-e2e-1k.test.mjs` to verify 1k hashes.
  - Add `tests/vitest/sha256-regression.test.mjs` to verify sample hash, UTF‑8 umlaut case, crack candidate match, WIP behavior, and YAML parsing.
  - Add fixture `tests/vitest/fixtures/coded_level_24.yaml` with:
    level: 24
    coded: "MELDE DICH BEI DER LEHRKRAFT WENN DU DEN TOKEN GEFUNDEN HAST"
- Update docs: `docs/DATENFLUSS.md`, `docs/SCORING.md`, `js/ciphers/AGENTS.md`, and `AGENTS.md`.

Run:
- `pnpm run test:node`
- `pnpm run test:vitest -- tests/vitest/sha256-regression.test.mjs tests/vitest/sha256-keyless-e2e-1k.test.mjs tests/vitest/docs-gates.test.mjs`

Do not use git commands. Avoid new dependencies.