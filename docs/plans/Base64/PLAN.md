# Base64‑Cipher Integration (Plan + Hand‑Off)

**Summary**
- Implementiere einen neuen keyless `Base64`‑Cipher mit UTF‑8‑sicherem Encode/Decode und tolerantem Input (Whitespace, fehlendes Padding, URL‑safe Varianten).
- Ergänze Regression‑ und 1k‑E2E‑Tests inkl. Beispieltext (`UNSCHAERFE IM IMPULS` aus `coded_level_15.js`).
- Aktualisiere Doku‑Verträge (`js/ciphers/AGENTS.md`, `docs/SCORING.md`) und binde das neue Cipher‑Script in `index.html` ein.

**Key Changes**
1. **Cipher‑Implementierung**
   - Neue Datei `js/ciphers/base64Cipher.js` im IIFE‑Stil (wie andere Ciphers).
   - `id: "base64"`, `name: "Base64"`, `supportsKey: false`.
   - UTF‑8‑Encoding/Decoding via `TextEncoder`/`TextDecoder` mit Fallback‑Implementierung (analog XOR).
   - Eigene Base64‑Encode/Decode‑Routinen (keine `btoa/atob`‑Abhängigkeit), damit:
     - UTF‑8 sicher ist
     - Tests im VM‑Context ohne `Buffer` funktionieren
   - **Input‑Toleranz**:
     - Whitespace entfernen
     - `-` → `+`, `_` → `/` (URL‑safe)
     - Fehlendes Padding ergänzen (`len % 4 == 2 -> ==`, `len % 4 == 3 -> =`, `len % 4 == 1 -> Fehler`)
     - Ungültige Zeichen -> klarer Fehlertext
   - **Crack‑Pfad**: `crack(text)` dekodiert Base64 deterministisch und liefert:
     - `key: null`, `text: decoded`, `confidence: <computed>`
     - Confidence via `dictionaryScorer.analyzeTextQuality` (falls vorhanden) + fallback‑Heuristik, damit Ranking stabil bleibt.
   - **Kommentare**: Bei jedem nicht‑trivialen Block „Warum“-Kommentare ergänzen (Projektregel).

2. **UI/Integration**
   - `index.html`: neues `<script src="js/ciphers/base64Cipher.js"></script>` vor `js/app.js`.
   - Keine UI‑Sonderbehandlung nötig; keyless‑Pfad nutzt automatisch den Crack‑Flow.

3. **Dokumentation**
   - `js/ciphers/AGENTS.md`: neuer Abschnitt **Base64** mit Vertrag, Keyless‑Hinweis und Crack‑Verhalten.
   - `docs/SCORING.md`: neuer Eintrag unter „Lokales Sprach‑Scoring“:
     - Base64 ist deterministisch (kein echtes Key‑Cracking), Confidence aus Qualitätsanalyse für UI‑Ranking.
   - `docs/DATENFLUSS.md`: nur ändern, wenn Base64 zusätzlichen Output‑Pfad oder UI‑Besonderheiten braucht (voraussichtlich nein).

4. **Tests**
   - `tests/vitest/base64-regression.test.mjs`:
     - Encode/Decode Roundtrip (ASCII und UTF‑8 mit Umlauten).
     - Beispieltext aus `coded_level_15.js`:
       - `parseInputFile` auf JS‑String -> Base64‑Decode -> `"UNSCHAERFE IM IMPULS"`.
     - Validierungsfälle: ungültige Zeichen, Länge `% 4 == 1`, URL‑safe Variante ohne Padding.
   - `tests/vitest/generators/base64Dataset.js`:
     - Deterministischer Seed‑Generator (wie XOR‑Dataset).
     - 1000 unterschiedliche Klartexte.
   - `tests/vitest/base64-keyless-e2e-1k.test.mjs`:
     - 1000‑Lauf: `decrypt(encrypt(text)) === text` oder `crack(ciphertext).text === text`.
     - Runtime‑Budget definieren (z. B. < 2 Minuten).

**Test Plan**
- Kurze Gates (ohne Langläufer):
  1. `pnpm run test:node`
  2. `pnpm run test:vitest -- tests/vitest/base64-regression.test.mjs`
- Langläufer (nur auf explizite Anforderung, wie von dir gefordert):
  3. `pnpm run test:vitest -- tests/vitest/base64-keyless-e2e-1k.test.mjs`
- Optionaler Cipher‑Isolation‑Check per `node -e` (siehe Debug‑Checklist) mit:
  - `js/core/cipherRegistry.js`
  - `js/ciphers/base64Cipher.js`

**Abgabekriterien**
- Base64‑Cipher integriert, UI funktioniert ohne Sonderlogik.
- Encode/Decode korrekt für ASCII + UTF‑8.
- `crack` liefert deterministisch `{ key: null, text: string, confidence: number }`.
- Regressionstest grün.
- 1k‑Test existiert (Ausführung nur auf Anforderung).
- Doku‑Synchronität: `js/ciphers/AGENTS.md` + `docs/SCORING.md` aktualisiert.

**Assumptions**
- Base64 darf tolerant sein (Whitespace, URL‑safe, fehlendes Padding).
- Keine neuen Dependencies.
- Out‑of‑scope: bestehende 1k‑Gate‑Fehler (columnar/xor) bleiben unberührt.
