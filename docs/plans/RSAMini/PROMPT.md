Du implementierst RSA‑Mini in der Kryptografie‑Werkbank. Bitte strikt nach dem Plan vorgehen unter "docs/plans/RSAMini/PLAN.md":

Lese  zuerst die Markdown-Dokumentationen (außer unter docs/plans). Dann:

1) Neuer Cipher `js/ciphers/rsaMiniCipher.js` im IIFE‑Stil.
   - id: "rsa-mini", name: "RSA Mini"
   - supportsKey: true, supportsCrackLengthHint: true
   - keyLabel: "RSA-Parameter", keyPlaceholder: "p=11, q=17, n=187, e=7, d=23"
   - crackLengthLabel: "Privater Schlüssel (d,n)", crackLengthPlaceholder: "d=23, n=187"
   - Zahlentokens als Input/Output (Whitespace/Komma/Semikolon getrennt).
   - BigInt für alle Rechnungen; modPow via Square-and-Multiply.
   - parseKey:
     * akzeptiert Objekt {p,q,n,e,d} oder String
     * labeled Paare bevorzugen; exakt 5 unlabelte Zahlen = p,q,n,e,d
     * Teilmengen ohne Labels => Fehlerhinweis
     * wenn p,q vorhanden: n prüfen/ableiten, phi=(p-1)(q-1), Primtests
     * e/d Validierung via gcd + modInverse; wenn möglich d ableiten
   - encrypt braucht n,e; decrypt braucht n,d; Tokens müssen 0..n-1 sein.
   - crack erwartet options.d und options.n, liefert confidence=1.
   - Kommentare im Code mit Fokus auf „Warum“.

2) `js/app.js`: parseCrackOptions erweitern
   - wenn cipher.parseCrackHint existiert und Crack‑Hint‑Feld nicht leer, parseCrackHint(raw) aufrufen und Rückgabe in options mergen.
   - Standard‑Int‑Parsing bleibt für andere Ciphers unverändert.

3) `index.html`: `js/ciphers/rsaMiniCipher.js` vor `js/app.js` einbinden.

4) Tests:
   - Generator `tests/vitest/generators/rsaMiniDataset.js` mit SeededRNG.
   - Mehrere Keypairs (Prime‑Liste, p≠q, e aus Kandidaten, d per Inverses).
   - Pflichtfall: plaintext "53", ciphertext "26", p=11 q=17 n=187 e=7 d=23.
   - Regressionstest `tests/vitest/rsa-mini-regression.test.mjs`.
   - 1k‑Gate `tests/vitest/rsa-mini-keyless-e2e-1k.test.mjs` mit Runtime‑Limit < 2 Min.

5) Docs:
   - `js/ciphers/AGENTS.md`: RSA‑Mini Abschnitt.
   - `docs/SCORING.md`: RSA‑Eintrag (kein Sprach‑Scoring, deterministisch).
   - `docs/DATENFLUSS.md`: RSA‑Hinweise zu Zahlentokens + Crack‑Hint `d,n`.
   - `AGENTS.md`: minimaler Hinweis auf RSA‑Mini im Cipher‑Bereich.

6) Tests laufen lassen:
   - node --check auf neue Dateien
   - pnpm run test:vitest -- tests/vitest/rsa-mini-regression.test.mjs tests/vitest/rsa-mini-keyless-e2e-1k.test.mjs
   - pnpm run test:node (bekannter Fail wegen benchmark_context_tokens ist toleriert, nicht beheben)
