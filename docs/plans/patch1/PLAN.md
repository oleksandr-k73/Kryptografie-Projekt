**Title**
Fix‑Plan: UI‑Guard, Segment‑Parity, YAML‑Blanklines, Rail‑Fence Bias, Loader‑Order

**Summary**
- Alle Findings sind im aktuellen Code bestätigt; Tests im Sandbox‑Run auf dem aktuellen Stand sind grün.
- Die Fixes sind präzise beschrieben und mit Diff‑Orientierung versehen, damit ein Folge‑Agent direkt umsetzen kann.

**Public API**
- `railFenceCipher.decrypt(...)` liefert nur noch Rohtext (echte Inversion); Segmentierung bleibt Crack‑Pfad.

**Key Changes**
- `js/app.js`: `runButton.disabled` vor dem ersten `await`, `try/finally` über Enrichment + Crack ausweiten, Kommentar warum.
- `js/ciphers/playfairCipher.js`: `scoreCandidateText` über `chooseDisplaySegment` führen, damit Scoring/Anzeige konsistent bleiben.
- `js/ciphers/railFenceCipher.js`: Fixture‑Fragmente aus Fallback‑Listen entfernen; `decrypt()` gibt Rohtext zurück.
- `js/core/dictionaryScorer.js`: Cache‑Key in `buildSharedSegmentBaseModel` nach Lexikon‑Verfügbarkeit splitten.
- `js/core/fileParsers.js`: `#` nur bei Start/Whitespace als Kommentar; Blank‑Lines in `prepareYamlLines` erhalten; Parser‑Loops überspringen leere Zeilen.
- Tests: Loader‑Reihenfolge überall `segmentLexiconData` vor `dictionaryScorer`; Playfair‑Key‑Shortlist pro Input; Rail‑Fence‑Decrypt‑Assertion auf Rohtext.
- Docs: `docs/SCORING.md`, `docs/DATENFLUSS.md`, `js/ciphers/AGENTS.md` anpassen, damit `decrypt()` nicht mehr als segmentierend beschrieben wird.

**Orientation Diffs (nicht angewendet)**
- `js/app.js`
```diff
@@
-    const crackOptions = parseCrackOptions(cipher);
-    await enrichCrackOptionsWithKeyCandidates(cipher, text, crackOptions);
+    const crackOptions = parseCrackOptions(cipher);
+    // Guard vor dem ersten await, damit schnelle Doppelklicks keinen Parallel-Run starten.
+    elements.runButton.disabled = true;
+    try {
+      await enrichCrackOptionsWithKeyCandidates(cipher, text, crackOptions);
@@
-    // Die Deaktivierung verhindert Doppelstarts während langer Crack-Läufe;
-    // ohne diesen Guard entstehen leicht konkurrierende Berechnungen und UI-Rennen.
-    elements.runButton.disabled = true;
-    try {
+      // Das Rendering muss vor dem CPU-intensiven Crack einmal zurück an den Browser,
+      // damit der Wartehinweis sichtbar ist, bevor die Hauptschleife blockiert.
       await new Promise((resolve) => requestAnimationFrame(resolve));
@@
-    } finally {
-      elements.runButton.disabled = false;
-    }
+    } finally {
+      elements.runButton.disabled = false;
+    }
```

- `tests/vitest/vigenere-regression.test.mjs`
```diff
@@
-  const window = loadBrowserContext(
-    ["js/ciphers/vigenereCipher.js", "js/core/dictionaryScorer.js"],
+  const window = loadBrowserContext(
+    ["js/ciphers/vigenereCipher.js", "js/core/segmentLexiconData.js", "js/core/dictionaryScorer.js"],
@@
-  const online = loadBrowserContext(
-    ["js/ciphers/vigenereCipher.js", "js/core/dictionaryScorer.js"],
+  const online = loadBrowserContext(
+    ["js/ciphers/vigenereCipher.js", "js/core/segmentLexiconData.js", "js/core/dictionaryScorer.js"],
@@
-  const offline = loadBrowserContext(
-    ["js/ciphers/vigenereCipher.js", "js/core/dictionaryScorer.js"],
+  const offline = loadBrowserContext(
+    ["js/ciphers/vigenereCipher.js", "js/core/segmentLexiconData.js", "js/core/dictionaryScorer.js"],
```

- `js/ciphers/playfairCipher.js`
```diff
@@
-  function scoreCandidateText(text, options) {
-    const stripped = removeDidacticPadding(text);
-    const segmented = segmentDidacticText(stripped, options);
+  function scoreCandidateText(text, options) {
+    // Scoring muss dieselbe Segmentierung nutzen wie decrypt()/crack(), sonst driftet Ranking vs Anzeige.
+    const segmented = chooseDisplaySegment(text, options);
@@
-    const qualityScore = Number.isFinite(segmented.qualityScore)
-      ? segmented.qualityScore
-      : segmented.confidence * 12;
+    const qualityScore = Number.isFinite(segmented.qualityScore)
+      ? segmented.qualityScore
+      : (Number(segmented.confidence) || 0) * 12;
```

- `js/ciphers/railFenceCipher.js`
```diff
@@
-  const COMMON_WORDS = [
+  // Fixture-spezifische Fragmente bleiben draußen, damit die lokale Shortlist echte Klartexte nicht wegdrückt.
+  const COMMON_WORDS = [
@@
-    " of ",
-    " poten",
-    " modell",
-    " signal",
-    " quant",
+    " of ",
+    " modell",
+    " signal",
   ];
@@
-  const COMMON_TRIGRAMS = new Set([
+  const COMMON_TRIGRAMS = new Set([
@@
-    "ell",
-    "mod",
-    "top",
+    "ell",
   ]);
@@
-  decrypt(text, key) {
-    const rails = this.parseKey(key);
-    const rawText = decryptRailFence(text, rails);
-    const maxRails = Math.max(rails, Math.min(12, Math.max(2, rawText.length - 1)));
-
-    // Bekannte Rails sollen dieselbe lesbare Ausgabe liefern wie der Crack-Pfad,
-    // damit das UI nicht je nach Eingabemodus zwischen Rohtext und sinnvoller Segmentierung springt.
-    return analyzeCandidateText(rawText, rails, maxRails).text;
-  },
+  decrypt(text, key) {
+    const rails = this.parseKey(key);
+    const rawText = decryptRailFence(text, rails);
+    // decrypt() bleibt echte Inversion; Segmentierung ist dem Crack-Pfad vorbehalten.
+    return rawText;
+  },
```

- `js/core/dictionaryScorer.js`
```diff
@@
-  function buildSharedSegmentBaseModel() {
-    const cacheKey = "__shared__";
-    const cached = segmentModelCache.get(cacheKey);
+  function buildSharedSegmentBaseModel() {
+    const lexiconData = getSegmentLexiconData();
+    // Cache-Key unterscheidet Fallback vs Vollladung, damit spätere Lexika nicht blockiert werden.
+    const cacheKey = lexiconData ? "__shared__" : "__shared__fallback";
+    const cached = segmentModelCache.get(cacheKey);
@@
-    const lexiconData = getSegmentLexiconData();
     if (lexiconData) {
```

- `js/core/fileParsers.js`
```diff
@@
-      if (!inSingleQuotes && !inDoubleQuotes && ch === "#") {
-        break;
-      }
+      if (!inSingleQuotes && !inDoubleQuotes && ch === "#") {
+        const prev = line[index - 1];
+        if (index === 0 || /\s/.test(prev)) {
+          break;
+        }
+      }
@@
-      const stripped = stripYamlInlineComment(rawLine);
-      if (!stripped.trim()) {
-        continue;
-      }
-
-      const indentMatch = stripped.match(/^ */);
-      const indent = indentMatch ? indentMatch[0].length : 0;
-      const content = stripped.slice(indent);
+      const stripped = stripYamlInlineComment(rawLine);
+      const indentMatch = rawLine.match(/^ */);
+      const indent = indentMatch ? indentMatch[0].length : 0;
+      const content = stripped.slice(indent);
+      if (!stripped.trim()) {
+        // Blank-Lines bleiben erhalten, damit Block-Scalars Absatzgrenzen erkennen.
+        lines.push({ indent, content: "", lineNumber: index + 1 });
+        continue;
+      }
```

- `js/core/fileParsers.js` (Parser‑Loops Blank‑Lines)
```diff
+  function skipYamlBlankLines(lines, startIndex) {
+    let index = startIndex;
+    while (index < lines.length && !lines[index].content) {
+      index += 1;
+    }
+    return index;
+  }
@@
-  function parseYamlBlock(lines, startIndex, indent) {
+  function parseYamlBlock(lines, startIndex, indent) {
+    let index = skipYamlBlankLines(lines, startIndex);
+    if (index >= lines.length) {
+      return { value: null, nextIndex: index };
+    }
-    const current = lines[startIndex];
+    const current = lines[index];
@@
-    if (current.indent < indent) {
+    if (current.indent < indent) {
       return {
         value: null,
-        nextIndex: startIndex,
+        nextIndex: index,
       };
     }
@@
-    if (current.content === "-" || current.content.startsWith("- ")) {
-      return parseYamlSequence(lines, startIndex, indent);
+    if (current.content === "-" || current.content.startsWith("- ")) {
+      return parseYamlSequence(lines, index, indent);
     }
-    return parseYamlMapping(lines, startIndex, indent);
+    return parseYamlMapping(lines, index, indent);
   }
@@
-    while (index < lines.length) {
+    while (index < lines.length) {
       const line = lines[index];
+      if (!line.content) {
+        index += 1;
+        continue;
+      }
@@
-    while (index < lines.length) {
+    while (index < lines.length) {
       const line = lines[index];
+      if (!line.content) {
+        index += 1;
+        continue;
+      }
```

- `tests/vitest/playfair-keyless-e2e-1k.test.mjs`
```diff
@@
-  const window = loadBrowserContext([
-    "js/ciphers/playfairCipher.js",
-    "js/core/dictionaryScorer.js",
-  ]);
+  const window = loadBrowserContext([
+    "js/ciphers/playfairCipher.js",
+    "js/core/segmentLexiconData.js",
+    "js/core/dictionaryScorer.js",
+  ]);
@@
-      const keyCandidates = scorer.getKeyCandidates({
-        languageHints: ["de", "en"],
-        limit: 320,
-      });
-
       for (const testCase of dataset) {
         const cipherText = playfair.encrypt(testCase.plaintext, testCase.key);
+        // Per-Input-Shortlist wie im UI: verhindert globalen Bias.
+        const keyCandidates = scorer.getKeyCandidates({
+          languageHints: ["de", "en"],
+          text: cipherText,
+          minLength: 4,
+          maxLength: 12,
+          limit: 260,
+        });
         const cracked = playfair.crack(cipherText, {
           keyCandidates,
           languageHints: ["de", "en"],
         });
```

- `tests/vitest/railFence-keyless-e2e-1k.test.mjs`
```diff
@@
-  const window = loadBrowserContext([
-    "js/ciphers/railFenceCipher.js",
-    "js/core/dictionaryScorer.js",
-  ]);
+  const window = loadBrowserContext([
+    "js/ciphers/railFenceCipher.js",
+    "js/core/segmentLexiconData.js",
+    "js/core/dictionaryScorer.js",
+  ]);
```

- `tests/vitest/railFence-regression.test.mjs`
```diff
@@
-  const window = loadBrowserContext([
-    "js/core/fileParsers.js",
-    "js/ciphers/railFenceCipher.js",
-    "js/core/dictionaryScorer.js",
-  ]);
+  const window = loadBrowserContext([
+    "js/core/fileParsers.js",
+    "js/ciphers/railFenceCipher.js",
+    "js/core/segmentLexiconData.js",
+    "js/core/dictionaryScorer.js",
+  ]);
@@
-  const decrypted = railFence.decrypt("PNLFEOETATPMDLTIOOL", 3);
-  expect(decrypted).toBe("POTENTIALTOPF MODELL");
+  const decrypted = railFence.decrypt("PNLFEOETATPMDLTIOOL", 3);
+  // decrypt() garantiert Rohtext-Inversion; Segmentierung bleibt im Crack-Pfad.
+  expect(decrypted).toBe("POTENTIALTOPFMODELL");
```

**Test Plan**
```bash
node --test tests/docs/*.test.mjs \
  && ./node_modules/.bin/vitest run tests/vitest/*.test.mjs \
  && node scripts/docs/run_quality_gates.mjs --iterations 25
```

**Assumptions**
- Cache‑Key‑Split als `__shared__` vs `__shared__fallback`.
- Blank‑Lines werden in Parser‑Loops ignoriert, bleiben aber in Block‑Scalars erhalten.
- Playfair‑Key‑Candidates pro Input mit `text`, `minLength: 4`, `maxLength: 12`, `limit: 260`.
