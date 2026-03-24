**Title**
SHA‑256 Cipher + WIP‑Crack Scaffold (Keyless)

**Summary**
- Add a new SHA‑256 cipher that hashes raw UTF‑8 input to uppercase HEX, with a crack scaffold that only checks provided candidate plaintexts and otherwise reports WIP.
- Wire UI status so decrypt mode communicates “Entschlüsselung WIP” instead of implying successful cracking.
- Add deterministic 1k dataset tests, a regression suite (including the YAML example), and update the required docs.

**Implementation Changes**
- Add `js/ciphers/sha256Cipher.js` with a synchronous, optimized SHA‑256 implementation (precomputed constants, 32‑bit ops, typed arrays), UTF‑8 encoding fallback, and uppercase HEX output.
- Define cipher metadata: `id: "sha-256"`, `name: "SHA-256"`, `supportsKey: false`, `info` fields with an explicit WIP note for Entschlüsselung.
- Implement `crack(text, options)` to validate a 64‑HEX hash, then match against `options.candidates` (array of plaintexts); on match return the plaintext with high confidence, otherwise return a WIP‑flagged result with a clear message.
- Implement `decrypt(text)` as a clear, intentional error (hashing is one‑way) with a user‑safe message.
- Update `js/app.js` to detect a `cracked.search.wip === true` result and:
  - Skip dictionary ranking and candidate rendering.
  - Set status to `cracked.search.wipMessage` (fallback message if missing).
  - Keep output empty (or unchanged) to avoid implying success.
- Add SHA‑256 script include in `index.html` among cipher scripts, before `js/app.js`, consistent with current ordering.

**API / Interface Notes**
- New crack option: `options.candidates` (array of plaintext strings) for hash matching.
- New crack result hint: `cracked.search.wip` and `cracked.search.wipMessage` to signal UI WIP handling.
- No new UI inputs; WIP is communicated via status and cipher info text.

**Test Plan**
- Add deterministic dataset generator in `tests/vitest/generators/sha256Dataset.js` using seeded RNG + Node `crypto` for reference hashes.
- Add 1k gate in `tests/vitest/sha256-keyless-e2e-1k.test.mjs`:
  - Build a 1000‑case dataset with unique plaintexts.
  - Assert `sha256Cipher.encrypt(...)` matches all expected hashes.
  - Enforce runtime threshold (e.g. < 2 minutes).
- Add regression suite in `tests/vitest/sha256-regression.test.mjs`:
  - Hash of the provided YAML example matches `5C2A90...CD53`.
  - UTF‑8 umlaut case matches Node `crypto` reference.
  - `crack` matches when `options.candidates` contains the plaintext.
  - `crack` returns WIP when no candidates; `decrypt` throws a clear error.
  - YAML fixture parsing yields the expected plaintext before hashing.
- Add fixture `tests/vitest/fixtures/coded_level_24.yaml` mirroring the provided sample.
- Run targeted checks after implementation:
  1. `pnpm run test:node`
  2. `pnpm run test:vitest -- tests/vitest/sha256-regression.test.mjs tests/vitest/sha256-keyless-e2e-1k.test.mjs tests/vitest/docs-gates.test.mjs`

**Documentation Updates**
- Update `docs/DATENFLUSS.md` to mention SHA‑256’s keyless crack‑stub/WIP path and status messaging.
- Update `docs/SCORING.md` with a new SHA‑256 entry describing the candidate‑match stub and WIP behavior.
- Update `js/ciphers/AGENTS.md` with a SHA‑256 section and contract notes.
- Update root `AGENTS.md` to mention the new cipher in the cipher module examples.

**Acceptance Criteria (Abgabekriterien)**
- SHA‑256 hashing outputs correct uppercase HEX for the YAML example and UTF‑8 umlaut input.
- Decrypt mode does not claim success; UI shows explicit WIP status for SHA‑256.
- Crack stub matches when provided with candidate plaintexts and reports WIP otherwise.
- 1k SHA‑256 dataset test passes within the runtime gate.
- Docs gates pass and all required docs reflect SHA‑256 behavior.

**Assumptions**
- Hashing uses raw UTF‑8 input without normalization beyond encoding (no trim/uppercase).
- `options.candidates` is the only crack scaffold input for now.
- `decrypt` is explicitly unsupported and throws a clear, user‑facing error.
- Cipher `id` is `sha-256` and UI name is `SHA-256`.

**Hand‑Off Prompt**
```text

```
