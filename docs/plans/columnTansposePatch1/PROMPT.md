- Kontext (kurz): Repository enthält mehrere `normalizeBase`‑Implementierungen. Aktuelle Fehlerquelle: Replace vor Unicode‑Normalization entfernt oder misshandelt zusammengesetzte Umlaut‑Zeichen. Ziel: sichere NFD‑first Transliteration, identisch in allen Ciphers.
- Aufgabe (konkret):
  1. Öffne columnarTranspositionCipher.js und ersetze `normalizeBase` durch eine Implementierung, die:
     - führt `input = String(input || "").normalize("NFD")`;
     - ersetzt Umlaut‑Formen (sowohl precomposed und decomposed) in dieser Reihenfolge: Ä/ä → AE, Ö/ö → OE, Ü/ü → UE, ß → SS (case‑insensitive handling; result in ASCII digraphs);
     - entfernt Combining‑Marks: `.replace(/[\u0300-\u036f]/g, "")`;
     - wandelt zu Großbuchstaben: `.toUpperCase()`.
  2. Mache dieselbe Änderung in playfairCipher.js und scytaleCipher.js.
  3. Führe die gezielten Tests: `npx vitest run tests/vitest/columnar-regression.test.mjs`. Wenn Node nicht lokal verfügbar, führe die Browser‑Sanity‑Checks (Console) wie oben angegeben.
  4. Falls Tests fehlschlagen, sammle die ersten 20 Fehlermeldungen und fälle Entscheidung: (A) Anpassung `parseKeywordKey` Tiebreaker (nur falls Keyword‑Sortierung betroffen) oder (B) roll back und instrumentiere `normalizeBase` mit debug‑logs für betroffene Inputs.
  5. Commit: `"fix(columnar): normalize umlauts via NFD-first transliteration"`; liefere Patch‑Diff und Test‑Output in PR.
- Akzeptanz: Columnar regression grün + Browser sanity outputs match expected.
