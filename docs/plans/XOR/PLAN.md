# XOR‑Cipher: UTF‑8 XOR → HEX + Klartext (Hand‑Off Plan)

**Summary**
- Implementiere einen neuen XOR‑Cipher (UTF‑8‑Bytes, XOR mit ASCII‑Key, Ausgabe HEX uppercase).
- Ausgabe in der UI: HEX im Hauptfeld, Klartext im Rohfeld; Decrypt/Crack zeigen Klartext + HEX.
- Crack‑Pfad: Key‑Länge optional, unhinted Key‑Längenbereich wird durch Experiment/Benchmark bestimmt, Key‑Alphabet für Crack = printable ASCII 0x20–0x7E.
- Vollständige Tests inkl. 1000‑Fälle‑Gate und Beispieldatei.

**Key Changes**
1. **Neuer Cipher `js/ciphers/xorCipher.js` (IIFE, Registry‑konform)**
   - Contract: `id: "xor"`, `name: "XOR"`, `supportsKey: true`, `supportsCrackLengthHint: true`, `keyLabel: "Schlüssel"`, `keyPlaceholder: "z. B. KRYPTO"`.
   - `parseKey(rawKey)`:
     - Validiert ASCII 0x00–0x7F, nicht leer.
     - Warum‑Kommentar: ASCII‑Validation früh, damit UI‑Fehler klar statt späterer Byte‑Fehler.
   - UTF‑8‑Bytes:
     - `encodeUtf8(text)` via `TextEncoder`.
     - `decodeUtf8(bytes)` via `TextDecoder("utf-8", { fatal: false })`, mit Fallback‑Kommentar.
   - HEX Utilities:
     - `normalizeHexInput(text)` → entfernt Whitespace, uppercase, validiert even‑length und `[0-9A-F]`.
     - `bytesToHex(bytes)` → uppercase, ohne Separator.
     - `hexToBytes(hex)`.
   - `encrypt(text, key)`:
     - `textBytes XOR keyBytes` (ASCII bytes).
     - Rückgabe = HEX uppercase.
   - `decrypt(text, key)`:
     - Eingabe muss HEX sein → `normalizeHexInput`.
     - XOR → UTF‑8 decode → Klartext.
   - `crack(text, options)`:
     - Eingabe HEX normalisieren.
     - Key‑Längen:
       - Wenn `options.keyLength` gesetzt: clamp 1..textBytes.length.
       - Sonst `DEFAULT_MAX_KEY_LENGTH` (durch Experiment ermittelt, siehe Tests).
     - Key‑Alphabet für Crack: printable ASCII 0x20–0x7E (95 Bytes).
     - **Key‑Ableitung pro Position**:
       - Für jede Position im Key: Score pro Kandidat‑Byte anhand der XOR‑Slice.
       - Score heuristisch: + für Buchstaben/Spaces, - für Steuerzeichen/Non‑Printable, leichter Bonus für häufige Zeichen.
       - Nimm Top‑K pro Position (K=2–3) und baue 1–N Schlüsselvarianten (limitierte Kombination, z. B. Beam‑Width 120).
     - Volltext‑Scoring:
       - `dictionaryScorer.analyzeTextQuality` (falls vorhanden) für finalen Score.
       - Fallback‑Score (ähnlich Cäsar) bei fehlendem Scorer.
     - Rückgabe:
       - `{ key, text, confidence, rawText: normalizedHex, candidates: topN }`.
     - Kommentare: warum per‑Position Scoring (Skalierung) und warum Beam‑Limit (Performance‑Gate).
   - `info`‑Block mit kurzem Zweck/Prozess/Crack/Use‑Case (UTF‑8‑Umlaute).

2. **UI‑Integration `index.html` + `js/app.js`**
   - `index.html`: `<script src="js/ciphers/xorCipher.js"></script>` vor `js/app.js`.
   - `js/app.js`:
     - **Encrypt‑Pfad**: wenn `cipher.id === "xor"`, dann `setOutputTexts(hex, plainInput)` damit HEX + Klartext sichtbar sind.
     - **Decrypt‑Pfad**: wenn `cipher.id === "xor"`, `setOutputTexts(plainText, normalizedHexInput)`.
     - **Crack‑Pfad**: wenn `cipher.id === "xor"`, `setOutputTexts(best.text, best.rawText)` ohne Segmentierung.
     - Keine Segmentierung des HEX‑Rohtexts (kein `segmentRawText` auf HEX anwenden).
     - Kommentare mit “Warum” an XOR‑Sonderpfaden.

3. **Tests**
   - **Generator** `tests/vitest/generators/xorDataset.js`:
     - Deterministischer RNG wie bei Rail Fence.
     - Pflichtfälle:
       - Beispieldatei: `KRYPTO` + `QUANTEN SPRUNG`.
       - 3–5 weitere fixe Fälle mit klaren Texten.
     - 1000 Fälle:
       - Klartexte aus Bausteinen (ähnlich affine/railFence), mit Leerzeichen.
       - Keys: Uppercase A–Z (Subset von printable ASCII) für Crack‑Stabilität.
   - **Vitest**:
     - `xor-regression.test.mjs`
       - `encrypt("QUANTEN SPRUNG", "KRYPTO")` → HEX = `1A07181E000A05720A00061A0515`.
       - `decrypt(hex, "KRYPTO")` → Klartext.
       - Validierung: HEX uppercase, even length, decrypt roundtrip.
     - `xor-keyless-e2e-1k.test.mjs`
       - Unhinted Crack Erfolgsrate + Hint‑Erfolg 1.0.
       - Runtime‑Budget definieren (z. B. < 2–3 Minuten).
   - **Experiment zur optimalen Max‑Key‑Länge**:
     - In Sandbox nach Implementierung kleine Messung:
       - Kandidatenwerte `maxLen ∈ {8, 12, 16, 20}`.
       - Für jeden Wert: 1k‑Testlauf, messen `successRate` und `elapsedMs`.
       - Wähle größtes `maxLen` mit `successRate >= 0.99` und `elapsedMs < 3 Minuten`.
     - Ergebnis in Code als `DEFAULT_MAX_KEY_LENGTH` fixieren und in Doku erwähnen.

4. **Doku‑Updates**
   - `js/ciphers/AGENTS.md`: neuer Abschnitt **XOR (`js/ciphers/xorCipher.js`)** mit Key‑Regeln, HEX‑Ausgabe, Crack‑Hinweisen.
   - `docs/SCORING.md`: Abschnitt „XOR“ unter 1) Lokales Scoring (Slice‑Scoring + optionaler Dictionary‑Score).
   - `docs/DATENFLUSS.md`: ergänzen, dass XOR im Decrypt/Crack die HEX‑Rohausgabe zeigt und im Encrypt Klartext als Rohfeld sichtbar ist.

**Test Plan**
1. `pnpm run test:node`
2. `pnpm run test:vitest -- tests/vitest/xor-regression.test.mjs`
3. `pnpm run test:vitest -- tests/vitest/xor-keyless-e2e-1k.test.mjs`
4. Falls Doku geändert: `pnpm run test:gates`
5. Akzeptiere nur, wenn alle obigen Tests grün sind.

**Abgabekriterien**
- XOR‑Cipher registriert fehlerfrei und erfüllt Contract.
- Beispieldatei decodiert zu **“QUANTEN SPRUNG”** mit Schlüssel **KRYPTO**.
- HEX‑Ausgabe uppercase, ohne Separator, even length.
- UI zeigt HEX + Klartext wie vereinbart.
- 1k‑Gate erreicht Ziel‑Success‑Rate und Zeitbudget.
- Doku konsistent mit Verhalten.
- Alle relevanten Tests grün.

**Assumptions / Defaults**
- Crack‑Alphabet: printable ASCII 0x20–0x7E.
- Dataset‑Keys im 1k‑Test: Uppercase A–Z für Crack‑Stabilität.
- `DEFAULT_MAX_KEY_LENGTH` wird experimentell festgelegt (größter Wert unter Zeit‑/Erfolgs‑Gate).
