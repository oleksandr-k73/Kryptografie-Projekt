# Base64‑Crack Fix Plan (1k‑E2E Fail)

**Summary**  
Behebt den Base64‑1k‑Fail, indem `crack()` den vollständigen Rohtext liefert und segmentierte Anzeige nur dann übernimmt, wenn sie den Inhalt nicht verändert. So bleibt die UI‑Segmentierung erhalten, ohne Ziffern/Teile des Klartexts zu verlieren.

**Key Changes (API/Behavior)**  
- `base64Cipher.crack()` liefert **immer** `rawText` (vollständiger dekodierter Klartext).  
- `text` wird nur dann mit `displayText` überschrieben, wenn der Inhalt gleich bleibt (z. B. Vergleich ohne Whitespace).  
- `confidence` basiert weiter auf `analyzeTextQuality`, aber **ohne** Kürzung des sichtbaren Klartexts.  
- Keine Änderungen an UI oder Tests erforderlich.

**Implementation Changes (entscheidungsfest)**  
- In `js/ciphers/base64Cipher.js`:
  - Nach `analyzeTextQuality(...)` `rawText` und `displayText` behalten.  
  - Vergleichslogik hinzufügen: `normalizeVisible(rawText) === normalizeVisible(displayText)` → nur dann `text = displayText`, sonst `text = rawText`.  
  - `rawText` explizit im Crack‑Result setzen.  
  - Warum‑Kommentare ergänzen (Projektregel).

**Tests**  
- Ausführen:  
  - `pnpm exec vitest run tests/vitest/base64-regression.test.mjs`  
  - `pnpm exec vitest run tests/vitest/base64-keyless-e2e-1k.test.mjs`  

**Abgabekriterien**  
1. `base64Cipher.crack()` liefert immer `rawText` mit dem vollständigen dekodierten Klartext.  
2. `text` wird nur dann aus `displayText` übernommen, wenn der Inhalt gleich bleibt (whitespace‑neutral, aber zeichen‑genau).  
3. `tests/vitest/base64-keyless-e2e-1k.test.mjs` ist grün (crackSuccessRate == 1.0).  
4. `tests/vitest/base64-regression.test.mjs` bleibt grün.  
5. Keine neuen Dependencies, keine UI‑/Doku‑Änderungen.

**Assumptions & Defaults**  
- `rawText` ist stets die Quelle der Wahrheit; Segmentierung darf **nie** Inhalt verlieren.  
- Vergleich erfolgt ohne Whitespace, aber mit vollständigem Zeichenbestand (Ziffern bleiben erhalten).  
- Keine Anpassungen an Tests oder UI nötig.

