Implementiere einen neuen ASCII‑Dezimal‑Cipher im Repo /home/mrphaot/Dokumente/Kryptografie-Projekt. Folge dem Plan unter "docs/plans/ASCII/PLAN.md". Hier ist die Zusammenfassung davon:

Anforderungen:
- Neuer Cipher: Datei `js/ciphers/asciiCipher.js` (IIFE), Export `window.KryptoCiphers.asciiCipher`, `id: "ascii"`, `name: "ASCII (Dezimalcodes)"`, `supportsKey: false`.
- Encrypt: wandelt jeden Char per `charCodeAt` in Dezimalzahl um, getrennt durch ein Leerzeichen; wirft Fehler, wenn Code > 255.
- Decrypt: akzeptiert nur Dezimalzahlen 0–255, getrennt durch Whitespace; leere Eingabe → leere Ausgabe; non‑numeric oder out‑of‑range → Fehler.
- Crack: keyless; ruft decrypt auf, liefert `{ key: null, text, rawText, confidence }`; confidence via `dictionaryScorer.analyzeTextQuality` wie Base64 (qualityScore + coverage*12 + meaningfulTokenRatio*6); Segmentierung nur übernehmen, wenn sichtbarer Inhalt gleich bleibt.
- Immer warum‑Kommentare im Code hinterlassen.

Integration:
- `index.html`: `<script src="js/ciphers/asciiCipher.js"></script>` vor `js/app.js`.
- Doku: `js/ciphers/AGENTS.md` um ASCII‑Abschnitt ergänzen; `docs/SCORING.md` um ASCII‑Scoring‑Pfad ergänzen.

Tests & Fixtures:
- Neue Fixture `tests/vitest/fixtures/coded_level_18.yaml` mit:
  level: 18
  coded: "76 65 83 69 82 32 84 82 73 70 70 84 32 71 73 84 84 69 82"
- Neuer Generator `tests/vitest/generators/asciiDataset.js` (Seeded RNG wie Base64, 1000 eindeutige Fälle, Pflichtfall „LASER TRIFFT GITTER“).
- Neue Tests:
  - `tests/vitest/ascii-regression.test.mjs` (Roundtrip, Fehlerfälle, YAML‑Fixture decode, crack‑shape).
  - `tests/vitest/ascii-keyless-e2e-1k.test.mjs` (decrypt+crack SuccessRate=1.0, Runtime < 2 min).
- Tests ausführen:
  - `pnpm exec vitest run tests/vitest/ascii-regression.test.mjs`
  - `pnpm exec vitest run tests/vitest/docs-gates.test.mjs`
  - 1k‑Gate nur nach Freigabe.

Erwarte, dass `encrypt("LASER TRIFFT GITTER")` exakt `76 65 83 69 82 32 84 82 73 70 70 84 32 71 73 84 84 69 82` erzeugt.