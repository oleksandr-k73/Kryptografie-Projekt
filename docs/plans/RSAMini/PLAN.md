**RSA‑Mini‑Cipher Integration Plan**

**Summary**
- Neuer Cipher `RSA Mini` mit numerischen Tokens, BigInt‑Modularpotenz, minimalen Schlüsselpaaren je Modus, und einem Crack‑Hint‑Feld für `d,n`.
- Tests: Regression + deterministischer 1000‑Fälle‑Gate mit **mehreren Keypairs** und der Beispieldatei (`26 → 53`).
- Doku‑Synchronisierung in `docs/DATENFLUSS.md`, `docs/SCORING.md`, `js/ciphers/AGENTS.md` und minimal in `AGENTS.md`.

**Implementation Changes**
- **Cipher: `js/ciphers/rsaMiniCipher.js`**
- IIFE + `window.KryptoCiphers.rsaMiniCipher`, `id: "rsa-mini"`, `name: "RSA Mini"`.
- `supportsKey: true`, `supportsCrackLengthHint: true`.
- `keyLabel: "RSA-Parameter"`, `keyPlaceholder: "p=11, q=17, n=187, e=7, d=23"`.
- `crackLengthLabel: "Privater Schlüssel (d,n)"`, `crackLengthPlaceholder: "d=23, n=187"`.
- **Inputformat**: Zahlenfolgen (Tokens durch Whitespace/Komma/Semikolon getrennt).  
- **Key‑Parsing**:
- Akzeptiert Objekt `{p,q,n,e,d}` oder String.
- String‑Parsing:
- Wenn Labels vorhanden, nutze `p|q|n|e|d`‑Paare.
- Wenn **genau 5** unlabelte Zahlen, interpretiere als `p,q,n,e,d`.
- Bei **Teilmenge ohne Labels** Fehler mit Hinweis auf `p=…`‑Schreibweise.
- **Validierung / Ableitung**:
- BigInt überall; ModPow via Square‑and‑Multiply.
- Wenn `p,q` gesetzt: `n = p*q` prüfen/ableiten; `phi = (p-1)(q-1)`.
- `p,q` als Primzahlen prüfen (trial division bis √n; Mini‑RSA).
- Wenn `phi` bekannt: `gcd(e,phi)=1` fordern; `d` als modulares Inverses berechnen, falls fehlt.
- Wenn `d` vorhanden und `phi` bekannt: `(d*e) mod phi == 1` prüfen.
- **Encrypt**: benötigt `n,e`, jedes `m` muss `0 ≤ m < n`. Ausgabe space‑separated Tokens.
- **Decrypt**: benötigt `n,d`, jedes `c` muss `0 ≤ c < n`. Ausgabe space‑separated Tokens.
- **Crack**:
- erwartet `options.d` und `options.n` (BigInt‑fähig); wenn fehlt, klare Fehlermeldung.
- entschlüsselt deterministisch, `confidence = 1`, `key` als `d=…, n=…`.
- **Kommentare** im Cipher mit Fokus auf „Warum“ (BigInt, Label‑Regel, Range‑Guards).

- **App‑Integration: `js/app.js`**
- `parseCrackOptions` erweitern:
- Wenn `cipher.parseCrackHint` existiert und Crack‑Hint‑Feld nicht leer ist, diese Methode aufrufen und Rückgabe in `options` mergen.
- Fallback‑Pfad (numerische Länge) bleibt unverändert für bestehende Ciphers.
- Keine Änderung an `reuseKeyForCrackHint`‑Logik.

- **HTML Integration: `index.html`**
- `<script src="js/ciphers/rsaMiniCipher.js"></script>` vor `js/app.js`.

- **Docs**
- `js/ciphers/AGENTS.md`: neuer Abschnitt „RSA Mini“ mit Key‑Format, Zahlen‑Tokens, Crack‑Hint `d,n`.
- `docs/SCORING.md`: RSA‑Eintrag unter „Lokales Sprach‑Scoring“ mit Hinweis „kein Sprach‑Scoring, deterministisch“.
- `docs/DATENFLUSS.md`: RSA‑Sonderfall im Decrypt/Crack‑Pfad erwähnen (Zahlentokens, Crack‑Hint `d,n`).
- `AGENTS.md`: minimaler Hinweis unter „Cipher‑Module“ auf RSA‑Mini‑Datei.

**Tests**
- **Generator**: `tests/vitest/generators/rsaMiniDataset.js`
- SeededRNG (wie andere Generatoren).
- Mehrere Keypairs:
- Prime‑Liste, p≠q.
- `phi` berechnen, `e` aus fester Kandidatenliste mit `gcd(e,phi)=1`.
- `d` als modulares Inverses.
- Klartext‑Tokens: 1–3 Integers, jeweils `2..n-2`, Signatur‑Deduping.
- Pflichtfall aus Beispiel: `plaintext="53"`, `ciphertext="26"`, `p=11,q=17,n=187,e=7,d=23`.

- **Regression**: `tests/vitest/rsa-mini-regression.test.mjs`
- Beispiel: `encrypt("53") -> "26"` und `decrypt("26") -> "53"`.
- `crack("26", { d: 23, n: 187 })` liefert `"53"`.
- Key‑Parsing: labeled vs. full 5‑Zahlen‑String.
- Fehlerfälle: `n`‑Mismatch, `e` nicht teilerfremd zu `phi`, Token ≥ n.

- **1k‑Gate**: `tests/vitest/rsa-mini-keyless-e2e-1k.test.mjs`
- Determinismus‑Check für Dataset (seed 42 o. ä.).
- Für jede Case:
- `decrypt(ciphertext, key)` == plaintext.
- `crack(ciphertext, { d, n })` == plaintext.
- Runtime‑Gate < 2 Minuten, SuccessRate 1.0.

**Test Plan**
- `node --check js/ciphers/rsaMiniCipher.js`
- `node --check tests/vitest/rsa-mini-regression.test.mjs`
- `node --check tests/vitest/rsa-mini-keyless-e2e-1k.test.mjs`
- `node --check tests/vitest/generators/rsaMiniDataset.js`
- `pnpm run test:node`  
- Erwartung: **rot** wegen `benchmark_context_tokens` (vorbestehend, toleriert).
- `pnpm run test:vitest -- tests/vitest/rsa-mini-regression.test.mjs tests/vitest/rsa-mini-keyless-e2e-1k.test.mjs`

**Acceptance Criteria (Abgabekriterien)**
- RSA‑Mini erscheint im UI‑Dropdown, ohne Script‑Order‑Konflikte.
- `encrypt("53", key)` erzeugt `"26"`, `decrypt("26", key)` ergibt `"53"`.
- `crack("26", { d, n })` liefert korrektes Ergebnis mit `confidence=1`.
- RSA‑1k‑Gate: SuccessRate 1.0, Laufzeit < 2 Minuten.
- Doku‑Updates in `AGENTS.md`, `docs/DATENFLUSS.md`, `docs/SCORING.md`, `js/ciphers/AGENTS.md` sind konsistent.
- Keine Regressionen in bestehenden Ciphers (außer bekannter, vorbestehender Token‑Gate‑Fehler).

**Assumptions**
- Klartext/Geheimtext sind **Zahlentokens**, keine Buchstaben‑Encodings.
- Teil‑Schlüssel ohne Labels sind **nicht** erlaubt (Ambiguitäts‑Guard).
- Crack nutzt das separate Hint‑Feld `d,n` (Key‑Feld bleibt leer).
- Vorbestehender `benchmark_context_tokens`‑Fail wird toleriert und **nicht** im RSA‑Plan behoben.