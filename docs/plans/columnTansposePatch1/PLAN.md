## Plan: Columnar Transposition Umlaut Fix

Kurz: Patch die Umlaut‑/ß‑Transliteration in allen Cipher‑`normalizeBase`‑Funktionen, sodass zuerst Unicode‑NFD angewendet, dann Umlaut‑Digraphen (`AE/AE/UE`) und `SS` für `ß` gesetzt, anschließend Combining‑Marks entfernt und zuletzt auf A–Z hochgeschlossen wird. Ziel: konsistente A–Z‑Normalisierung für `columnar-transposition` und verwandte Ciphers; Tests müssen danach die Columnar‑Regression bestehen.

### Steps
1. Ändere `normalizeBase` in columnarTranspositionCipher.js: ersetze die bestehende Implementierung durch eine NFD‑first‑Strategie und gezielte Umlaut‑/ß‑Ersetzung, dann Entfernen von Combining‑Marks und `toUpperCase()`.  
2. Mache identische Änderungen in `normalizeBase` in playfairCipher.js und scytaleCipher.js (Konsistenz über Ciphers).  
3. Prüfe Impact‑Scope: optional Review der Test‑Generatoren columnarDataset.js und scytaleDataset.js — nur anpassen, falls Tests explizit auf alte Transliteration angewiesen sind.  
4. Verifiziere lokal im Sandbox: führe gezielte Tests aus und manuelle Browser‑Sanity‑Checks (siehe Verifikation). Behebe unerwartete Nebenwirkungen falls nötig.  
5. Commit mit klarer Message und liefere Patch‑Diff, Test‑Output und kurze Rationale an Team/CI.

### Further Considerations
1. Scope: Nur Cipher‑`normalizeBase` ändern; Tests/Generators nur wenn fehlschlagend.  
2. Locale: Wir verwenden ASCII‑digraphs (AE/OE/UE, SS) bewusst für deterministic A–Z output. Keine locale‑sensitive sorting-Änderung.  
3. Sandbox: Wenn Node nicht verfügbar, Browser DevTools Checks ersetzen (siehe Verifikation).

**Wichtige Dateien**
- columnarTranspositionCipher.js — primär patchen  
- playfairCipher.js — konsistente Normalisierung  
- scytaleCipher.js — konsistente Normalisierung  
- Tests (Verifikation): columnar-regression.test.mjs  
- Test‑Generatoren (sichtbar prüfen): columnarDataset.js

**Verifikation (Akzeptanzkriterien)**
- Columnar‑Regression: alle Tests in columnar-regression.test.mjs laufen grün.  
- Manuelle Browser‑Sanity: nach Patch in der Console:
  - `KryptoCiphers.columnarTranspositionCipher.encrypt("POTENTIALTOPF MODELL", "3-1-4-2")` → `TIOOLPNLFEEAPDXOTTML`  
  - `KryptoCiphers.columnarTranspositionCipher.decrypt("TIOOLPNLFEEAPDXOTTML", "3-1-4-2")` → `POTENTIALTOPFMODELLX`  
- `parseKey` Verhalten unverändert; `keyword`‑Parsing weiterhin stabil.

Verwendbare Test‑/Sandbox‑Commands (lokal/CI)
```bash
# Install (if needed)
npm install
# gezielter Vitest
npx vitest run tests/vitest/columnar-regression.test.mjs
# oder pnpm
pnpm run test:vitest -- tests/vitest/columnar-regression.test.mjs
```

Bereit‑einsetzbarer Implementer‑Prompt
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

Anmerkung zur Sandbox/Portable Node
- Wenn du Node nicht systemweit installieren kannst, extrahiere dein portables Node (`nvm-noinstall` zip) und nutze den lokalen `node`/`npm` für die Testausführung; das ist der bevorzugte Weg zur reproduzierbaren Prüfung.

Wenn du willst, erstelle ich jetzt das exakte Patch‑Diff (nur als Text, nicht angewendet) und ein PR‑Beschreibungstemplate, das der Implementierer übernehmen kann. Soll ich das erzeugen?