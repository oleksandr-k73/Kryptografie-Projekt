Du arbeitest im Repo /home/mrphaot/Dokumente/Kryptografie-Projekt. Implementiere den Positionscipher nach dem Plan unter "docs/plans/positionscipher/PLAN.md". Zusammenfassung:

Ziel:
- Neuer Cipher „Positionscipher“ mit Block‑Permutation, A–Z‑Normalisierung, X‑Padding.
- Encrypt: pro Block Ausgabe in Permutationsreihenfolge (z. B. 2-5-3-1-4).
- Decrypt: inverse Permutation pro Block.
- Keyless‑Crack: standardmäßig Blocklängen 2..6, mit keyLength‑Hint genau diese Länge. Permutationen cachen.
- Scoring: schneller Fallback (Bigram/Trigram + Domain‑Wörter), Shortlist‑Scoring via dictionaryScorer.analyzeTextQuality; Confidence = qualityScore + coverage*10 + meaningfulTokenRatio*8 - internalXPenalty + domainBonus.
- Rohtext + segmentierte Anzeige analog Columnar/Skytale.

Dateien/Änderungen:
1) Neuer Cipher: js/ciphers/positionCipher.js
   - id: "position-cipher", name: "Positionscipher"
   - supportsKey: true, supportsCrackLengthHint: true
   - keyLabel: "Positions‑Permutation", keyPlaceholder: "z. B. 2-5-3-1-4"
   - crackLengthLabel: "Blocklänge", crackLengthPlaceholder: "z. B. 5"
   - Kommentare IMMER und warum-orientiert.

2) UI/Integration:
   - index.html: <script src="js/ciphers/positionCipher.js"></script> vor app.js
   - js/app.js: position-cipher in rawOnlyCiphers + showRawForCipher; trimTrailingX aktivieren.

3) Tests/Fixtures:
   - tests/vitest/fixtures/coded_level_17.xml (Inhalt aus /home/mrphaot/Downloads/coded_level_17.xml)
   - tests/vitest/position-regression.test.mjs (encrypt/decrypt + parseKey + fixture crack)
   - tests/vitest/generators/positionDataset.js (deterministisch, Pflichtfall QUANTEN, Keys 2..6)
   - tests/vitest/position-keyless-e2e-1k.test.mjs (unhinted ≥0.99, hinted =1.0, runtime < 3min)

4) Dokumentation:
   - docs/SCORING.md: neuen Abschnitt „Positionscipher“ nach Columnar
   - docs/DATENFLUSS.md: Positionscipher in Rohtext‑Listen (Decrypt + Crack)
   - js/ciphers/AGENTS.md: eigener Abschnitt mit Key‑Format, Normalisierung, Crack‑Range, Raw/Segmentierung.

Hinweise:
- Keine neuen Dependencies.
- Umlaute in UI‑Texten.
- segmentLexiconData.js bleibt vor dictionaryScorer.js geladen.
- Nach Änderungen: nur die neuen Tests ausführen (keine Vollsuite, außer 1k‑Gate explizit).

Tests (gezielt):
- pnpm run test:vitest -- tests/vitest/position-regression.test.mjs
- pnpm run test:vitest -- tests/vitest/position-keyless-e2e-1k.test.mjs