# Hand-off: Rail-Fence + YAML-Subset ohne neue Runtime-Dependency

## Summary
- Getesteter Sandbox-Prototyp:
  - Rail-Fence-Crack auf deterministischem 1000er-Datensatz: `1000/1000` Treffer in ca. `70.5s`.
  - YAML-Beispiel `/home/mrphaot/Downloads/coded_level_06.yaml` wird als `{ level: 6, coded: "PNLFEOETATPMDLTIOOL" }` erkannt.
  - Dessen Rail-Fence-Crack ergibt mit `3` Schienen sinnvoll `POTENTIALTOPF MODELL`.
- Festgelegte Produktentscheidungen:
  - Rail-Fence bekommt `encrypt`, `decrypt`, `crack` und einen optionalen Schienen-Hint.
  - Rail-Fence verschlüsselt den kompletten Zeichenstrom, nicht nur Buchstaben.
  - YAML wird als projektrelevanter Subset-Parser direkt in `js/core/fileParsers.js` implementiert; keine neue Runtime-Bibliothek im Browser.

## Implementation Changes
- Neuer Cipher `window.KryptoCiphers.railFenceCipher` in `js/ciphers/railFenceCipher.js`.
  - Vertrag:
    - `id: "rail-fence"`
    - `name: "Rail Fence"`
    - `supportsKey: true`
    - `supportsCrackLengthHint: true`
    - `keyLabel: "Schienen"`
    - `keyPlaceholder: "z. B. 3"`
    - `crackLengthLabel: "Schienenanzahl"`
    - `crackLengthPlaceholder: "z. B. 3"`
    - `parseKey(rawKey)` akzeptiert nur ganze Zahlen `>= 2`, sonst klare Fehlermeldung.
  - Algorithmus:
    - Gemeinsame Helper `buildRailPattern(length, rails)`, `encryptRailFence(text, rails)`, `decryptRailFence(text, rails)`.
    - `encrypt` und `decrypt` arbeiten auf allen Zeichen unverändert im Originalstrom.
    - `crack(text, options)` interpretiert den bestehenden generischen `options.keyLength`-Hint als Schienenzahl.
    - Ohne Hint werden exakt `rails = 2..min(12, text.length - 1)` getestet.
    - Mit Hint wird exakt die geclampte Schienenzahl `min(parsedHint, text.length - 1)` getestet.
  - Kandidatenscore:
    - Wenn `KryptoCore.dictionaryScorer?.analyzeTextQuality` verfügbar ist:
      - `score = qualityScore + coverage * 10 + meaningfulTokenRatio * 8 + max(0, 1 - abs(spaceRatio - 0.16) * 4) - (rails / maxRails) * 0.35`
      - Tie-Breaker: kleinere Schienenzahl zuerst.
    - Wenn kein Scorer verfügbar ist:
      - kompakter lokaler Fallback, an Caesar angelehnt: häufige Wörter + Bigramme + Trigramme + Space-Bonus.
  - Ausgabe-Regel:
    - `decrypt(...)` gibt immer den exakten Rohtext zurück.
    - `crack(...)` hält intern `rawText`.
    - Wenn `rawText` keine Whitespaces hat, aber `analyzeTextQuality(rawText).displayText` sinnvolle Segmentierung liefert und `coverage >= 0.55` sowie `meaningfulTokenRatio >= 0.55`, dann wird `candidate.text = displayText` und `candidate.rawText = rawText`.
    - Dadurch bleibt normales Decrypt exakt, während das YAML-Beispiel lesbar als `POTENTIALTOPF MODELL` ausgegeben wird.
  - `candidates` absteigend nach `confidence`; `key` ist die Schienenzahl.

- YAML-Subset in `js/core/fileParsers.js`.
  - Neue Extensions: `yaml`, `yml`.
  - Parser-Strategie:
    - Kommentare außerhalb von Quotes entfernen.
    - Unterstützte Formen: flache Mappings, verschachtelte Mappings per Indent, Sequenzen mit `-`, `- key: value`, quoted/plain scalars, `|`- und `>`-Block-Scalars, Zahlen/Booleans/null.
    - Ergebnis in JS-Objekt/Array überführen.
    - Danach vorhandene `extractBestStringFromJson(...)`-Logik wiederverwenden, damit starke Text-Keys wie `coded`, `cipher`, `text`, `message`, `payload` identisch priorisiert werden.
    - Wenn der YAML-Subset-Parser nichts Belastbares extrahiert oder auf nicht unterstützte fortgeschrittene Features stößt, nicht hart fehlschlagen, sondern auf den Originaltext zurückfallen.
  - Nicht unterstützen:
    - Anchors/Aliases, Tags, Merge-Keys, mehrdeutige Multi-Document-Merges als garantierte Feature-Pfade.
    - Diese Fälle dürfen best-effort auf Raw-Text fallen, aber nicht crashen.
  - `index.html`:
    - `accept` um `.yaml,.yml,text/yaml,application/yaml,application/x-yaml` erweitern.
    - Unterstützt-Text in der UI um YAML ergänzen.

- Doku- und Gate-Synchronität.
  - `index.html`: neues Cipher-Script vor `js/app.js`, Reihenfolge z. B. `caesar -> leet -> playfair -> railFence -> vigenere -> app`.
  - `AGENTS.md`: Parser-/Projektüberblick um YAML ergänzen; Überblick vollständig beibehalten.
  - `docs/DATENFLUSS.md`: `yaml`/`yml` plus Rail-Fence-Crack-Pfad dokumentieren.
  - `docs/SCORING.md`: neuen Abschnitt Rail-Fence mit Scoreformel und Display-Promotion-Regel ergänzen.
  - `js/ciphers/AGENTS.md`: neuen Abschnitt `## Rail Fence (`js/ciphers/railFenceCipher.js`)`.
  - `tests/docs/fixtures/doc-contracts.json` und `scripts/docs/check_code_doc_consistency.mjs` an neue Cipher-/Parser-Doku anpassen; dort ist die Cipher-Liste aktuell hart codiert.
  - Externe Download-Datei nicht direkt in Tests referenzieren; YAML-Beispiel als Repo-Fixture oder Inline-String ablegen.

## Test Plan
- Neue Rail-Fence-Regressionen:
  - `decrypt(encrypt(text, rails), rails) === text` für Rails `2..10` auf Texten mit Leerzeichen, Satzzeichen und Ziffern.
  - `parseKey` lehnt `1`, `0`, negative, leere und nicht-ganzzahlige Werte ab.
  - `crack(ciphertext, { keyLength: rails })` trifft immer exakten Schlüssel und Klartext.
  - Unhinted Pflichtfälle:
    - `POTENTIALTOPF MODELL` bei `rails=3`
    - mehrere Texte mit vorhandenen Whitespaces
    - mindestens ein Fall mit Satzzeichen.
  - YAML-Akzeptanzfall:
    - Fixture mit Inhalt des Beispiel-YAML muss `coded` extrahieren.
    - Rail-Fence-Crack darauf muss Top-Kandidat `key=3` und `text="POTENTIALTOPF MODELL"` liefern.

- Deterministischer 1000-Fälle-Lauf.
  - Neue Datei `tests/vitest/generators/railFenceDataset.js`.
  - Datensatz:
    - deterministischer Seed `42`
    - `1000` unterschiedliche Klartexte
    - Rails `2..10`
    - gemischter Wortpool aus Kryptografie-/Schul-Kontext
    - feste Pflichtfälle am Anfang, damit sie nie aus dem Gate herausrutschen.
  - Gate:
    - `unhinted successRate >= 0.995`
    - `hinted successRate === 1.0`
    - Laufzeit `< 3 Minuten`
  - Erfolgsmessung:
    - gegen `candidate.text` normalisiert auf Whitespace, damit die lesbare Segmentierung des YAML-Falls erlaubt bleibt.

- YAML-Parser-Regressionen in bestehender Parser-Testdatei:
  - `.yaml` und `.yml` werden erkannt.
  - flaches Mapping mit `coded`.
  - verschachteltes Mapping mit `payload.coded`.
  - Sequenzfall mit `- coded: ...`.
  - Block-Scalar `|` und Folded `>`.
  - Quotes mit `:` und `#`.
  - fortgeschrittene/ambige YAML-Form löst keinen Crash aus und fällt auf Raw-Text zurück.

- Abschließende Pflichtläufe:
  - `node --test tests/docs/*.test.mjs`
  - `./node_modules/.bin/vitest run tests/vitest/*.test.mjs`
  - `node scripts/docs/run_quality_gates.mjs --iterations 25`

## Assumptions And Defaults
- Kein neues Browser-Runtime-Paket für YAML.
- Der bestehende generische Crack-Hint `keyLength` bleibt aus Kompatibilitätsgründen erhalten und steht bei Rail-Fence fachlich für die Schienenzahl.
- Rail-Fence-Decrypt mit bekanntem Schlüssel bleibt roh und exakt; nur der Crack-Pfad darf lesbare Segmentierung ausgeben.
- Die sinnvolle Referenzausgabe für das angehängte YAML-Beispiel ist `POTENTIALTOPF MODELL`.
- Kommentare bleiben warum-fokussiert und knapp, gemäß Repo-Regeln.

