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
