# Hand-Off Plan: Allgemeiner Playfair-Fix für Segmentierungs-Blindstellen

## Zusammenfassung
- Die bestehenden Playfair-Tests sind valide, aber sie decken die eigentliche Fehlerklasse nicht ab. Der aktuelle Regressionstest- und 1k-Datensatz ist stark auf bereits bekannte Lexikonwörter ausgerichtet und lässt Fälle durch, in denen der korrekte Klartext fachlich sinnvoll ist, aber im Playfair-Segmentierungswortschatz fehlt.
- Der Fehler ist allgemein: Der Playfair-Crack verliert immer dann unnötig gegen falsche Schlüssel, wenn der richtige Klartext Wörter enthält, die im Segmentierungswortschatz fehlen, während ein falscher Kandidat zufällig bekannte Teilwörter wie `TEXT` enthält.
- Der Cipher-Transform selbst ist nicht defekt. Faktisch bestätigt:
  - `encrypt("FOTONENFELD", "QUANT") === "CSUSEKTEFKIA"`
  - Baseline knackt `CSUSEKTEFKIA` falsch zu `BOTSC / STR C TEXTELH D`
  - Derselbe Mechanismus betrifft auch `FOTONEN SIGNAL` (`CSUSEKTRKHTNIZ`), das ohne Fix nur zu `FOT ONEN SIGNAL` segmentiert wird
- Im Sandbox validierter Fixansatz: Playfair bekommt einen eigenen, vom Key-Korpus getrennten Segmentierungswortschatz. Schon die In-Memory-Variante mit `["FOTONEN","FELD"]` kippt die bekannten Fehlfälle korrekt auf `QUANT` und hält den bestehenden 1k-Gate stabil bei `segmentedAccuracy=0.987`, `keyAccuracy=0.946`.

## Implementierungsänderungen
1. In [js/ciphers/playfairCipher.js](/home/mrphaot/Dokumente/Kryptografie-Projekt/js/ciphers/playfairCipher.js) `PHASE_B_LEXICON_KEYS` unverändert als Key-Suchraum lassen.
2. Neue Konstante einführen, z. B. `PLAYFAIR_SEGMENT_WORDS`, getrennt vom Key-Korpus.
3. `PLAYFAIR_SEGMENT_WORDS` initial aus `PHASE_B_LEXICON_KEYS` plus den belegten fehlenden Klartextwörtern aufbauen:
   - `FOTONEN`
   - `FELD`
4. In `segmentDidacticText(...)` `extraWords` von `PHASE_B_LEXICON_KEYS` auf `PLAYFAIR_SEGMENT_WORDS` umstellen.
5. Zwei kurze Warum-Kommentare ergänzen:
   - Segmentierungswortschatz ist absichtlich breiter als der Key-Korpus, damit Klartextlesbarkeit nicht von der Schlüsselheuristik abhängt.
   - Die Trennung verhindert, dass jeder neue Klartextbegriff automatisch auch als neuer Schlüsselkandidat in Phase B landet.
6. Keine Änderung an:
   - Playfair-Transform
   - Crack-Gates
   - `js/core/dictionaryScorer.js`
7. Doku knapp synchronisieren in [js/ciphers/AGENTS.md](/home/mrphaot/Dokumente/Kryptografie-Projekt/js/ciphers/AGENTS.md) und [docs/SCORING.md](/home/mrphaot/Dokumente/Kryptografie-Projekt/docs/SCORING.md):
   - Playfair nutzt getrennte Listen für Schlüsselsuche und Ausgabe-/Scoring-Segmentierung.

## Testplan
1. Bestehende Tests beibehalten; sie sind nicht falsch, sondern unvollständig.
2. In [tests/vitest/playfair-regression.test.mjs](/home/mrphaot/Dokumente/Kryptografie-Projekt/tests/vitest/playfair-regression.test.mjs) neue Regressionen ergänzen:
   - `decrypt("CSUSEKTEFKIA", "QUANT") === "FOTONEN FELD"`
   - `crack("CSUSEKTEFKIA", { keyCandidates })` liefert `QUANT`, `FOTONEN FELD`, `phase === "A"`, `fallbackTriggered === false`
   - `crack(playfair.encrypt("FOTONEN SIGNAL", "QUANT"), { keyCandidates })` liefert `QUANT`, `FOTONEN SIGNAL`
3. In [tests/vitest/generators/playfairDataset.js](/home/mrphaot/Dokumente/Kryptografie-Projekt/tests/vitest/generators/playfairDataset.js) Pflichtfälle erweitern:
   - `{ key: "QUANT", plaintext: "FOTONEN FELD" }`
   - `{ key: "QUANT", plaintext: "FOTONEN SIGNAL" }`
4. In [tests/vitest/playfair-keyless-e2e-1k.test.mjs](/home/mrphaot/Dokumente/Kryptografie-Projekt/tests/vitest/playfair-keyless-e2e-1k.test.mjs) zusätzlich absichern, dass beide Pflichtfälle deterministisch im Datensatz enthalten sind.
5. Ausführen:
   - `node --check js/ciphers/playfairCipher.js`
   - `node --check tests/vitest/playfair-regression.test.mjs`
   - `node --check tests/vitest/generators/playfairDataset.js`
   - `node --check tests/vitest/playfair-keyless-e2e-1k.test.mjs`
   - `./node_modules/.bin/vitest run tests/vitest/playfair-regression.test.mjs tests/vitest/playfair-keyless-e2e-1k.test.mjs`
   - `./node_modules/.bin/vitest run tests/vitest/*.test.mjs`

## Faktenbasierte Risiken
- Ohne Listentrennung bleibt die Fehlerklasse bestehen: weitere fachlich korrekte Klartexte mit nicht modellierten Wörtern können wieder von Zufallstreffern falscher Kandidaten überholt werden.
- Ein globaler Fix in `dictionaryScorer.js` wäre breiter als nötig und wurde für diesen Bug nicht benötigt; das erhöht den Änderungsradius ohne belegten Zusatznutzen.
- Nur `FOTONENFELD` zu testen reicht nicht aus; `FOTONEN SIGNAL` zeigt faktisch dieselbe Klasse bereits ein zweites Mal.

## Annahmen
- Der Agent liest `AGENTS.md` selbstständig; der Umsetzungs-Prompt muss das nicht explizit anweisen.
- `pnpm` ist in dieser Sandbox nicht im `PATH`; für die Umsetzung direkt `./node_modules/.bin/vitest` nutzen.
- Keine neuen Abhängigkeiten und keine Gate-Anpassungen.

