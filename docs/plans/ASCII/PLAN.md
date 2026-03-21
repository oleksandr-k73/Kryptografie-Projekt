**ASCII‑Dezimal‑Cipher Update**

**Summary**
- Neuer keyless Cipher für ASCII‑Dezimalcodes (`0–255`), der Leerzeichen‑getrennte Dezimalwerte dekodiert und Klartext in Dezimalcodes kodiert.
- Vollständige Integration in UI, Doku und Tests inkl. 1k‑Gate und YAML‑Beispielfall.

**Key Changes**
- Implementiere `js/ciphers/asciiCipher.js` als IIFE mit Export `window.KryptoCiphers.asciiCipher`, `id: "ascii"`, `name: "ASCII (Dezimalcodes)"`, `supportsKey: false`, `encrypt/decrypt/crack`.
- Parsing/Validierung:
  - Decrypt akzeptiert nur Dezimalwerte `0–255`, getrennt durch Whitespace; leere Eingabe → leere Ausgabe.
  - Encrypt wirft Fehler bei Zeichen mit `charCodeAt(i) > 255`.
  - Fehlertexte klar und UI‑tauglich (z. B. „Eingabe darf nur Zahlen und Leerzeichen enthalten.“ und „Zahlen müssen im Bereich 0 bis 255 liegen.“).
- Crack‑Pfad:
  - `crack` nutzt `decrypt`, liefert `{ key: null, text, rawText, confidence }`.
  - `confidence` via `dictionaryScorer.analyzeTextQuality` mit `languageHints: ["de","en"]`, `maxWordLength: 40`; Fallback‑Heuristik analog zu `base64Cipher` (printable‑Ratio, Wort‑/Zeichen‑Heuristik).
  - Segmentierung nur übernehmen, wenn `displayText` denselben sichtbaren Inhalt behält (Whitespace‑neutraler Vergleich wie in `base64Cipher`).
- UI‑Integration:
  - `index.html` um `<script src="js/ciphers/asciiCipher.js"></script>` vor `js/app.js` ergänzen.
- Doku‑Sync:
  - `js/ciphers/AGENTS.md` um Abschnitt „ASCII“ erweitern.
  - `docs/SCORING.md` um Abschnitt „ASCII (Dezimalcodes)“ ergänzen (keyless, Parsing, Scoring‑Pfad).
- Tests & Fixtures:
  - Neue Fixture `tests/vitest/fixtures/coded_level_18.yaml` mit Inhalt aus der bereitgestellten Datei.
  - Neuer Generator `tests/vitest/generators/asciiDataset.js` (Seeded RNG wie Base64, eindeutige 1k‑Datensätze, Pflichtfälle inkl. „LASER TRIFFT GITTER“).
  - Neue Tests:
    - `tests/vitest/ascii-regression.test.mjs` (Roundtrip, Fehlerfälle, YAML‑Beispieldatei, Crack‑Shape).
    - `tests/vitest/ascii-keyless-e2e-1k.test.mjs` (1k‑Gate: decrypt+crack SuccessRate=1.0, Runtime < 2 min).

**Test Plan**
- Kurztests (kein Repo‑weiter Lauf):
  - `pnpm exec vitest run tests/vitest/ascii-regression.test.mjs`
  - `pnpm exec vitest run tests/vitest/docs-gates.test.mjs`  
- 1k‑Gate nur nach expliziter Freigabe:
  - `pnpm exec vitest run tests/vitest/ascii-keyless-e2e-1k.test.mjs`

**Abgabekriterien**
- `encrypt("LASER TRIFFT GITTER")` → `76 65 83 69 82 32 84 82 73 70 70 84 32 71 73 84 84 69 82`.
- `decrypt` und `crack` der YAML‑Fixture liefern exakt „LASER TRIFFT GITTER“; `confidence` ist finite Zahl.
- 1k‑Gate: `decrypt`‑ und `crack`‑SuccessRate = `1.0`, Laufzeit < 2 min (nach Freigabe).
- Doku konsistent: `js/ciphers/AGENTS.md` und `docs/SCORING.md` enthalten ASCII‑Abschnitt, Script‑Reihenfolge korrekt.

**Assumptions**
- Separatoren sind **nur** Whitespace; keine Kommas/Striche.
- ASCII‑Bereich ist `0–255` (wie abgestimmt); >255 wird abgewiesen.
- Plan wird jetzt geliefert; Tests werden erst bei Implementierung ausgeführt.

