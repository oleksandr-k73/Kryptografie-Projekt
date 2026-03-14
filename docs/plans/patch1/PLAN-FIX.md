# Plan: YAML‑Block‑Scalar Fix + Escape‑Decoding + Test‑Init‑Reihenfolgen

## Summary
- YAML‑Block‑Scalars behalten `#`‑Inhalt via `rawContent`, ohne andere Parserpfade zu verändern.
- Double‑quoted YAML Escapes werden korrekt dekodiert und unbekannte Escapes bleiben verlustfrei erhalten.
- Test‑Harness lädt Core‑Module konsistent vor Cipher‑Modulen.
- Playfair‑Keyless‑E2E nutzt text‑abhängige Key‑Kandidaten wie der UI‑Pfad.

## Implementation Changes
- `js/core/fileParsers.js`
  - In `prepareYamlLines()` zusätzlich `rawContent = rawLine.slice(indent)` speichern und in jedes `lines`‑Objekt ablegen.
  - In `readYamlBlockScalar()` `collected.push(line.rawContent)` nutzen und Kommentar ergänzen, warum Block‑Scalars `#` als Nutzdaten behandeln.
  - In `decodeYamlDoubleQuoted()`
    - `\uXXXX` und `\xXX` explizit parsen, dekodieren, Index passend vorrücken.
    - Bei zu kurzen/ungültigen Sequenzen auf Raw‑Preserve zurückfallen.
    - Unbekannte Escapes als `"\\" + next` erhalten.
- `tests/vitest/playfair-regression.test.mjs`
  - `loadRuntime()` und `loadFreshRuntime()` auf Core‑First umstellen:
    `["js/core/segmentLexiconData.js","js/core/dictionaryScorer.js","js/ciphers/playfairCipher.js"]`.
- `tests/vitest/playfair-keyless-e2e-1k.test.mjs`
  - Precompute‑Pfad entfernen.
  - Pro Testfall `scorer.getKeyCandidates({ languageHints: ["de","en"], text: cipherText, minLength: 4, maxLength: 12, limit: 260 })`.
  - Kommentar anpassen: Fokus auf UI‑Pfad‑Parity.
- `tests/vitest/railFence-keyless-e2e-1k.test.mjs`
  - Reihenfolge: `["js/core/segmentLexiconData.js","js/core/dictionaryScorer.js","js/ciphers/railFenceCipher.js"]`.
- `tests/vitest/railFence-regression.test.mjs`
  - Reihenfolge: `["js/core/fileParsers.js","js/core/segmentLexiconData.js","js/core/dictionaryScorer.js","js/ciphers/railFenceCipher.js"]`.

## Public APIs / Types
- Keine Änderungen an öffentlichen Interfaces oder Typen.

## Test Plan
- `node --test tests/docs/*.test.mjs`
- `node_modules/.bin/vitest run tests/vitest/*.test.mjs`
- `node scripts/docs/run_quality_gates.mjs --iterations 25`

## Abgabekriterien
- YAML‑Block‑Scalar‑Inhalte behalten `#` unverändert.
- Double‑Quoted YAML decodiert `\uXXXX`/`\xXX` korrekt und verliert unbekannte Escapes nicht.
- Test‑Loader nutzen Core‑First‑Reihenfolge.
- Playfair‑Keyless‑E2E nutzt text‑abhängige Key‑Candidates mit Limit 260.
- Tests/Qualitätsgates sind grün.

## Assumptions
- Die Änderungen sind nicht „umfangreich“ im Sinne der Doku‑Update‑Pflicht.
- `pnpm`/`npm` sind weiterhin nicht verfügbar; Tests laufen über `node`/`node_modules/.bin`.


