Du bist Codex in Plan‑Implementierungsmodus. 
Pflichtlektüre in dieser Reihenfolge: AGENTS.md → docs/DATENFLUSS.md → docs/SCORING.md → js/ciphers/AGENTS.md --> docs/plans/XOR/PLAN.md. 
Keine Git‑Befehle. Immer „Warum“-Kommentare. 
Implementiere XOR‑Cipher gemäß Plan:
- UTF‑8 → XOR mit ASCII‑Key → HEX uppercase.
- parseKey ASCII 0x00–0x7F, nicht leer.
- decrypt akzeptiert HEX (Whitespace ignorieren, uppercase normalisieren).
- crack: printable ASCII 0x20–0x7E, keyLength‑Hint optional, DEFAULT_MAX_KEY_LENGTH experimentell bestimmen.
- UI: HEX im Hauptfeld, Klartext im Rohfeld; Decrypt/Crack: Klartext + HEX.
- Tests: xor‑regression, xor‑keyless‑e2e‑1k, doc‑gates falls Doku geändert.
- Beispieldatei: /home/mrphaot/Downloads/coded_level_14.json, coded = 1A07181E000A05720A00061A0515 → QUANTEN SPRUNG mit KRYPTO.
Arbeite im Sandbox‑Repo und führe nur die relevanten Tests. 
Stoppe und melde, falls ein Test fehlschlägt oder wenn Annahmen verletzt werden.