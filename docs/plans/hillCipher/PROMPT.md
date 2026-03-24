Du bist ein erfahrener Experten-Coder im Repo /home/mrphaot/Dokumente/Kryptografie-Projekt. 
Implementiere den Hill‑Cipher gemäß dem Plan unter docs/plans/hillCipher/PLAN.md:
- Neuer Cipher `hill` (Matrix‑Key n×n, modulo 26, A‑Z‑Normalisierung, Padding X).
- UI: dynamisches Matrixfeld (Default 2×2) + Feld für n; Key‑Input für Hill ausblenden.
- Keyless‑Crack nur 2×2, Bruteforce 0..25 je Eintrag, det invertierbar mod 26.
- Segmentierte Anzeige wie bei Skytale/Columnar (trimTrailingX true).
- Kommentare immer mit „Warum“-Fokus.

Pflicht‑Dateien:
`js/ciphers/hillCipher.js`, `index.html`, `styles.css`, `js/app.js`,
`js/ciphers/AGENTS.md`, `docs/SCORING.md`, `docs/DATENFLUSS.md`,
`tests/vitest/fixtures/coded_level_11.xml`,
`tests/vitest/hill-regression.test.mjs`,
`tests/vitest/generators/hillDataset.js`,
`tests/vitest/hill-keyed-e2e-1k.test.mjs`.

Tests (ausführen, sobald Implementierung fertig):
- `pnpm run test:vitest -- tests/vitest/hill-regression.test.mjs`
- `pnpm run test:vitest -- tests/vitest/hill-keyed-e2e-1k.test.mjs`

Beachte: keine Git‑Befehle, keine neuen Dependencies, Umlaute als echte UTF‑8‑Zeichen.