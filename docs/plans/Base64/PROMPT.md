Du implementierst den neuen Base64‑Cipher gemäß dem Plan unter docs/plans/Base64/PLAN.md im Projekt /home/mrphaot/Dokumente/Kryptografie-Projekt. 

Lies zuerst die Markdown-Dokus (außer unter docs/plans), dann den Plan.

Kontext:
- Neues Cipher-Modul in js/ciphers/base64Cipher.js (IIFE, an window.KryptoCiphers hängen).
- Base64 ist keyless (supportsKey: false), crack ist deterministisches Decode.
- UTF‑8 sicher: TextEncoder/TextDecoder + Fallback (wie XOR).
- Eigene Base64-Encode/Decode-Routinen (kein btoa/atob).
- Input tolerant: Whitespace entfernen, URL-safe („-“, „_“) akzeptieren, fehlendes Padding ergänzen, `%4==1` Fehler.
- Confidence aus dictionaryScorer.analyzeTextQuality (fallback heuristics).
- IMMER „Warum“-Kommentare ergänzen.
- index.html: Script vor js/app.js einbinden.
- Doku: js/ciphers/AGENTS.md + docs/SCORING.md aktualisieren.
- Tests: base64-regression + base64-keyless-e2e-1k + generator (deterministisch).
- Beispieltext: /home/mrphaot/Downloads/coded_level_15.js enthält `VU5TQ0hBRVJGRSBJTSBJTVBVTFM=` → `UNSCHAERFE IM IMPULS`.
- Keine neuen Dependencies.

Erledige die Änderungen, aktualisiere die Doku, und liefere Testplan + Ergebnisse der kurzen Tests.