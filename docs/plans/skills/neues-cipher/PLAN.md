# Implementierungsplan: Skill `cipher-new-method`

## Ziel
Einen kombinierten Skill erstellen, der:
1. die Implementierung eines neuen Verschlüsselungsverfahrens strukturiert anleitet,
2. cipher-spezifisches Debugging abdeckt,
3. klare Verifikations-/Freigabekriterien vorgibt.

## Zielpfade
1. `skills/cipher-new-method/SKILL.md`
2. `skills/cipher-new-method/references/debug-checklist.md`
3. `skills/cipher-new-method/agents/openai.yaml`

Der Skill ist Projekt spezifisch. Daher ist 'skills/' im Repository-Ordner zu erstellen.

## Inhalt: `skills/cipher-new-method/SKILL.md`
```md
---
name: cipher-new-method
description: Leitfaden zur Implementierung und zum Debugging eines neuen Verschlüsselungsverfahrens. Verwenden bei neuen oder fehlerhaften Cipher-Modulen, wenn strukturierte Prüfungen für encrypt/decrypt/crack, Kandidaten-Ranking und Regressionen benötigt werden.
---

# Neues Verschlüsselungsverfahren

## Vorgehen

1. Datei `js/ciphers/<cipherFile>.js` anlegen.
2. IIFE-Muster verwenden und Cipher an `window.KryptoCiphers` anhängen.
3. Mindeststruktur implementieren:
   - `id` (eindeutig)
   - `name`
   - `encrypt(text, key?)`
   - `decrypt(text, key?)`
   - `crack(text, options?)`
4. Optionale UI-Felder nur bei Bedarf setzen:
   - `supportsKey`
   - `keyLabel`, `keyPlaceholder`
   - `supportsCrackLengthHint`
   - `crackLengthLabel`, `crackLengthPlaceholder`
   - `info: { purpose, process, crack, useCase }`
5. Optional `parseKey(raw)` ergänzen, wenn ein Schlüssel validiert/normalisiert werden muss.
6. Rückgabe von `crack(...)` mindestens als `{ key, text, confidence }`, optional zusätzlich `candidates`.
7. In `index.html` neues Cipher-Script vor `js/app.js` einbinden.

## Debugging

### Startbefehle

```bash
node --check js/ciphers/<cipherFile>.js
rg -n "<script src=\"js/ciphers/|<script src=\"js/app.js\"" index.html
```

### Spezifische Methoden und Befehle

Siehe `references/debug-checklist.md` für die vollständige Version. Kurzüberblick:

1. Reproduktions-Check
2. Input-/Output-Nachverfolgung
3. Cipher-Isolation
4. Kandidaten-Analyse
5. API/Fallback-Abgleich
6. Regressions-Check

## Verifikation und Freigabekriterien

1. Alle Startbefehle und alle sechs Debuggingmethoden müssen grün sein; bei einem Fehler alles beheben und vollständig erneut prüfen.
2. Pflichtschnittstellen müssen exakt vorhanden sein und registrierbar sein:
   - `id` als String
   - `name` als String
   - `encrypt` als Funktion
   - `decrypt` als Funktion
   - `crack` als Funktion
   - Registrierung über `CipherRegistry.register(...)` ohne Fehler
3. Verfahrenslogik muss je nach Typ korrekt sein:
   - bei `supportsKey: true`: `decrypt(encrypt(text,key),key) === text`
   - bei `supportsKey: false`: `encrypt/decrypt/crack` laufen ohne Laufzeitfehler und liefern String-Ausgaben
4. `crack(...)` muss mindestens liefern:
   - `text` als String
   - `confidence` als Number
   - `key`, falls das Verfahren einen Schlüssel ableitet
   - optionale `candidates` müssen nach `confidence` sortierbar und plausibel sein
5. Integration muss vollständig sein:
   - neues Cipher-Script steht in `index.html` vor `js/app.js`
   - Verfahren erscheint im Dropdown
   - benötigte Modi funktionieren (encrypt/decrypt, ggf. keyloses Cracken)
6. Regressionsfälle dürfen sich nicht verschlechtern (feste Referenzinputs vor/nach Änderung vergleichen).
```

## Inhalt: `skills/cipher-new-method/references/debug-checklist.md`
```md
# Debug-Checkliste für neues Verschlüsselungsverfahren

## 1) Reproduktions-Check

1. Feste Testwerte definieren: Klartext, Chiffretext, Schlüssel/Optionen.
2. Gleiche Eingaben mehrfach ausführen.
3. Pass-Kriterium: gleiche Eingabe ergibt denselben Kandidaten/Schlüssel.

## 2) Input-/Output-Nachverfolgung

1. Für jeden Testfall Input, Parameter und Output loggen.
2. Erwarteten Output neben den tatsächlichen Output legen.
3. Pass-Kriterium: Abweichungen sind erklärbar oder behoben.

## 3) Cipher-Isolation (ohne UI)

```bash
node -e 'const fs=require("fs"),vm=require("vm");const c={window:{}};vm.createContext(c);["js/core/cipherRegistry.js","js/ciphers/<cipherFile>.js"].forEach(p=>vm.runInContext(fs.readFileSync(p,"utf8"),c));const x=c.window.KryptoCiphers.<cipherExport>;const r=new c.window.KryptoCore.CipherRegistry();r.register(x);const p="Attack at dawn";const k=<testKey>;const e=x.encrypt(p,k);const d=x.decrypt(e,k);if(x.supportsKey&&d!==p)throw new Error("roundtrip-fail");const cr=x.crack(e,{});if(!cr||typeof cr.text!=="string"||typeof cr.confidence!=="number")throw new Error("crack-shape-fail");console.log("cipher-isolation-ok");'
```

Pass-Kriterium: Registrierung, Roundtrip (bei key-basiert) und `crack`-Shape sind korrekt.

## 4) Kandidaten-Analyse

Ziel: sicherstellen, dass das Ranking verarbeitbar und inhaltlich nachvollziehbar ist.

Prüfen:
1. `candidates` ist vorhanden, wenn das Verfahren mehrere Kandidaten liefern kann.
2. Kandidaten sind absteigend nach `confidence` sortierbar.
3. Top-Kandidat ist für den Testtext plausibel; bei sehr kurzen Texten Unschärfe dokumentieren.

```bash
node -e 'const fs=require("fs"),vm=require("vm");const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync("js/ciphers/<cipherFile>.js","utf8"),c);const x=c.window.KryptoCiphers.<cipherExport>;const r=x.crack("<cipherText>",{});const L=r.candidates||[];for(let i=1;i<L.length;i++){if((L[i-1].confidence??-Infinity)<(L[i].confidence??-Infinity))throw new Error("candidate-sort-fail")}console.log("candidate-analysis-ok",L.length,r.text);'
```

Pass-Kriterium: Sortierung ist korrekt, und der Top-Kandidat ist plausibel oder begründet als unsicher markiert.

## 5) API/Fallback-Abgleich

```bash
node -e 'const fs=require("fs"),vm=require("vm");const c={window:{},fetch:global.fetch,AbortController:global.AbortController,setTimeout,clearTimeout};vm.createContext(c);vm.runInContext(fs.readFileSync("js/core/dictionaryScorer.js","utf8"),c);(async()=>{const s=c.window.KryptoCore.dictionaryScorer;const r=await s.rankCandidates([{key:1,text:"hallo welt und ich",confidence:1},{key:2,text:"xqzv jkkm ptt",confidence:2}],{languageHints:["de","en"]});if(!r.bestCandidate)throw new Error("ranking-fail");console.log("api-fallback-check-ok",r.apiAvailable);})().catch(e=>{console.error(e);process.exit(1)});'
```

Pass-Kriterium: Ranking liefert stabil `bestCandidate`; API-Status (`apiAvailable`) ist konsistent.

## 6) Regressions-Check

Ziel: bestehende Qualität absichern und versehentliche Verschlechterungen früh erkennen.

Prüfen:
1. Vor der Änderung feste Baselines für `encrypt`, `decrypt`, `crack` notieren.
2. Nach der Änderung identische Inputs erneut ausführen.
3. Unterschiede nur akzeptieren, wenn nachvollziehbar verbessert und dokumentiert.

```bash
node -e 'const fs=require("fs"),vm=require("vm");const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync("js/ciphers/<cipherFile>.js","utf8"),c);const x=c.window.KryptoCiphers.<cipherExport>;const baseline={enc:x.encrypt("<plainText>",<testKey>),dec:x.decrypt("<cipherText>",<testKey>),cr:x.crack("<cipherText>",{}).text};const rerun={enc:x.encrypt("<plainText>",<testKey>),dec:x.decrypt("<cipherText>",<testKey>),cr:x.crack("<cipherText>",{}).text};if(JSON.stringify(baseline)!==JSON.stringify(rerun))throw new Error("regression-fail");console.log("regression-check-ok",baseline,rerun);'
```

Pass-Kriterium: Referenzfälle bleiben stabil oder sind nachweislich verbessert.

## 7) Einbindungs-Check

```bash
node -e 'const fs=require("fs");const h=fs.readFileSync("index.html","utf8");const c=h.indexOf("js/ciphers/<cipherFile>.js");const a=h.indexOf("js/app.js");if(c>=0&&a>=0&&c<a){console.log("integration-order-ok")}else{console.error("integration-order-fail");process.exit(1)}'
```

Pass-Kriterium: Cipher-Script steht vor `js/app.js`.

## Abschlussregel

1. Jede Methode (`1` bis `7`) muss grün sein.
2. Bei Rot: beheben, komplette Checkliste erneut ausführen.
3. Erst freigeben, wenn alle Checks grün sind.
```

## Inhalt: `skills/cipher-new-method/agents/openai.yaml`
```yaml
interface:
  display_name: "Neues Verschlüsselungsverfahren"
  short_description: "Cipher implementieren und strukturiert debuggen"
  default_prompt: "Use $cipher-new-method to implement and verify a new cipher module with structured debugging."
```

## Umsetzungsschritte in der anderen Session
1. `mkdir -p docs/plans/skills`
2. Inhalt dieses Dokuments nach `docs/plans/skills/PLAN.md` schreiben.
3. Danach die drei Skill-Dateien gemäß Plan anlegen.
4. `python3 /home/mrphaot/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/cipher-new-method` ausführen.

## Abnahmekriterien
1. `docs/plans/skills/PLAN.md` existiert und enthält den vollständigen Plan.
2. Alle drei Skill-Dateien sind erstellt.
3. `quick_validate.py` meldet `Skill is valid!`.
```

## Prompt für den anderen Chat (sofort nutzbar)
```text
Bitte implementiere exakt den Plan aus `docs/plans/skills/PLAN.md`.

Wichtig:
1. Halte dich 1:1 an die Inhalte und Dateipfade im Plan.
2. Erstelle diese Dateien:
   - skills/cipher-new-method/SKILL.md
   - skills/cipher-new-method/references/debug-checklist.md
   - skills/cipher-new-method/agents/openai.yaml
3. Führe danach die Validierung aus:
   python3 /home/mrphaot/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/cipher-new-method
4. Zeige mir am Ende:
   - die erstellten Dateien mit kurzem Inhaltsabgleich,
   - das Validator-Ergebnis,
   - und bestätige, dass nichts außerhalb dieser Pfade geändert wurde.
```
