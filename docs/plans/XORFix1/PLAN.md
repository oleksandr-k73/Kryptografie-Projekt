# XOR‑Crack‑Fix Plan (Genauigkeit + Laufzeit)

**Summary**  
Ziel ist es, die XOR‑Crack‑Genauigkeit wieder auf ≥0,99 (unhinted & hinted) zu bringen und die 1k‑Suite unter 3 Minuten zu halten. Dafür ersetzen wir die Beam‑Kombination durch eine **k‑best Enumeration nach Score‑Summe** (Priority‑Queue), nutzen **Top‑3 Längen** (unhinted), begrenzen die Kandidatenzahl pro Länge und werten nur eine kleine Shortlist mit dem Dictionary‑Scorer aus.

**Implementation Changes**  
1. **Neue Kombinationssuche (k‑best, Score‑Summe)**
   - In `js/ciphers/xorCipher.js` eine Funktion `enumerateByScoreSum(positionCandidates, maxCandidates)` einführen.
   - Algorithmus: Max‑Heap über Index‑Tupel; Start `(0,0,...,0)`; bei jedem Pop Nachbarn erzeugen (je eine Dimension +1). Duplizierte Index‑Tupel via `Set` verhindern.
   - Rückgabe: Liste von Kandidaten (Index‑Tupel) in absteigender Summe der Positions‑Scores.

2. **Crack‑Pipeline umstellen**
   - `beamCombineCandidates(...)` in `buildCandidatesForLengths(...)` durch `enumerateByScoreSum(...)` ersetzen.
   - Pro Länge **maxCandidates = 2000** (empfohlen), `topK` pro Position = **10** (auswertung gezeigt: korrekte Bytes liegen <10).
   - Unhinted: **Top‑3 Längen** anhand der `baseScore`‑Heuristik (wie bisher `baseScore` aus Position‑Top1‑Key) auswählen.  
     - Hinweis: Hamming/IOC ist hier schlecht (nur ~31% Top‑2). Die bestehende `baseScore`‑Heuristik trifft Top‑3 ca. 99,2%.
   - Hinted: nur die getippte Länge nutzen.

3. **Scoring & Bias‑Fix**
   - **Längen‑Penalty entfernen** (`-info.keyLength * 0.2`) im `fallbackConfidence`, da das zu kurzen Schlüsseln bias’t.
   - `fallbackConfidence` weiter aus `fallbackScore + entry.score * 0.01 + allowedRatio * 6` ableiten, aber ohne `keyLength`‑Penalty.
   - Das hält die Längenwahl ausschließlich in der Länge‑Vorfilterung.

4. **Shortlist‑Analyse kleiner machen**
   - `ANALYSIS_SHORTLIST_SIZE` auf **40–60** reduzieren (empfohlen 48).
   - `PER_LENGTH_ANALYSIS` auf **8–10** reduzieren (empfohlen 8).
   - Dadurch bleibt `analyzeTextQuality` performant, aber steigert die Trefferquote bei knappem Ranking.

5. **Konstanten aktualisieren**
   - `STRICT_POSITION_CANDIDATE_CAP` auf **10** setzen (statt 26), passend zu Top‑K.
   - Optional: `MAX_COMBO_CANDIDATES = 2000`, `UNHINTED_LENGTHS = 3` als neue Konstanten für Klarheit.

6. **Optionaler Fallback (nur wenn notwendig)**
   - Falls `confidence` unter einem klaren Schwellenwert liegt (z. B. < 0), kann ein zweiter Lauf mit `KEY_BYTES_PRINTABLE` erfolgen.
   - Dieser Schritt ist optional; für die Tests reicht die A‑Z‑Schiene.

**Public API/Interface Changes**  
Keine öffentlichen API‑Änderungen. Nur internes Crack‑Verhalten in `xorCipher`.

**Test Plan**  
1. `pnpm run test:vitest -- tests/vitest/xor-regression.test.mjs`  
2. `pnpm run test:vitest -- tests/vitest/xor-keyless-e2e-1k.test.mjs`  

**Acceptance Criteria**  
- Unhinted und hinted ≥ 0,99.  
- 1k‑Suite < 3 Minuten.  
- Kein Regressionseinbruch bei `xor-regression`.

**Assumptions**  
- Crack‑Keys der Testdaten bleiben A‑Z; UTF‑8‑XOR‑Decode bleibt wie bisher.  
- Dictionary‑Scorer bleibt verfügbar (Fallback weiter vorhanden).  
- Performance‑Ziel wird mit `maxCandidates=2000`, Top‑3 Längen, Shortlist 48/8 erreicht.