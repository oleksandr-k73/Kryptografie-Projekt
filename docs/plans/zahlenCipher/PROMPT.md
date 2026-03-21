Du bist ein Codex-Agent im Repo /home/mrphaot/Dokumente/Kryptografie-Projekt.
Implementiere den neuen Cipher „Zahlen‑Cäsar“ gemäß dem Plan unter "docs/plans/zahlenCipher/PLAN.md". Zusammenfassung:

- Encrypt: Klartext -> normalisieren (A-Z, Umlaute AE/OE/UE, ß->SS) -> Caesar-Shift (Key, mod 26) -> A1Z26-Ausgabe mit '-' Separatoren.
- Decrypt: Input ist A1Z26 (1–26), Separatoren '-' + Whitespace; invalid => Error; Zahlen -> Buchstaben -> Caesar rückwärts; Rückgabe ohne Leerzeichen.
- Crack: 26 Shifts auf dekodierten Buchstaben; Cäsar-Heuristik als Score; gib `text`, `rawText`, `confidence`, `key`, `candidates` (Top 8) aus.
- Neues Script: `js/ciphers/numberCaesarCipher.js`, Export `window.KryptoCiphers.numberCaesarCipher`, `id="number-caesar"`, `name="Zahlen-Cäsar"`.

UI/Integration:
- `index.html` Script vor `js/app.js` einbinden.
- `js/app.js`: `rawOnlyCiphers` und `showRawForCipher` um `"number-caesar"` ergänzen, damit Segmentierung + Raw-Output angezeigt werden.

Docs:
- `js/ciphers/AGENTS.md` neuen Abschnitt „Zahlen‑Cäsar“.
- `docs/SCORING.md` neues Unterkapitel unter „Lokales Sprach‑Scoring in den Ciphers“.
- `docs/DATENFLUSS.md` ergänzen (Segmentierung/Raw‑Output im Decrypt/Crack‑Pfad).

Tests:
- Fixture `tests/vitest/fixtures/coded_level_16.csv` (level,coded; coded=16-18-…).
- `tests/vitest/number-caesar-regression.test.mjs` (parseKey, Roundtrip, Fixture decrypt+crack).
- Generator `tests/vitest/generators/numberCaesarDataset.js` (SeededRNG, 1000 eindeutige Fälle).
- `tests/vitest/number-caesar-keyless-e2e-1k.test.mjs` (unhinted >=0.99, hinted==1.0, runtime < 3min).

Beachte: Kommentare sind Pflicht und sollen das “Warum” erklären. Keine Git‑Befehle. Keine großen Abhängigkeiten. 
Führe nur die neuen Tests aus (siehe oben).