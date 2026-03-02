# Debug-Checkliste für neues Verschlüsselungsverfahren

## Vorbedingungen

1. Doku-Reihenfolge wurde eingehalten:
- `AGENTS.md` -> `docs/DATENFLUSS.md` -> `docs/SCORING.md` -> `js/ciphers/AGENTS.md`
2. Referenz-Testfälle sind fixiert (Klartext, Chiffretext, Schlüssel/Optionen).
3. Zu prüfende Datei und Export sind festgelegt:
- `js/ciphers/<cipherFile>.js`
- `window.KryptoCiphers.<cipherExport>`
4. Vollständige Baseline-Tests laufen vor Detail-Debugging:
- `pnpm run test:node`
- `pnpm run test:vitest`
- `pnpm run test:gates`

## 1) Reproduktions-Check

1. Gleiche Eingaben mindestens zweimal ausführen.
2. Prüfen, ob dieselbe Ausgabe inkl. Schlüssel/Kandidat entsteht.

Pass-Kriterium:
- Deterministisches Verhalten für identische Inputs.

## 2) Input-/Output-Nachverfolgung

1. Rohinput, geparsten Input (falls Dateiimport) und Output getrennt notieren.
2. Erwartete und tatsächliche Ausgabe direkt vergleichen.

Pass-Kriterium:
- Jede Abweichung ist entweder behoben oder begründet dokumentiert.

## 3) Cipher-Isolation (ohne UI)

```bash
node -e 'const fs=require("fs"),vm=require("vm");const c={window:{}};vm.createContext(c);["js/core/cipherRegistry.js","js/ciphers/<cipherFile>.js"].forEach(p=>vm.runInContext(fs.readFileSync(p,"utf8"),c));const x=c.window.KryptoCiphers.<cipherExport>;const r=new c.window.KryptoCore.CipherRegistry();r.register(x);const p="Attack at dawn";const k=<testKey>;const e=x.encrypt(p,k);const d=x.decrypt(e,k);if(x.supportsKey&&d!==p)throw new Error("roundtrip-fail");const cr=x.crack(e,{});if(!cr||typeof cr.text!=="string"||typeof cr.confidence!=="number")throw new Error("crack-shape-fail");console.log("cipher-isolation-ok");'
```

Pass-Kriterium:
- Registrierung ok, Roundtrip ok (bei key-basiert), Crack-Shape ok.

## 4) Kandidatenanalyse

Prüfen:
1. Mehrkandidaten-Verfahren liefern `candidates`.
2. Sortierung nach `confidence` ist absteigend möglich.
3. Top-Kandidat ist plausibel; bei sehr kurzem Text Unsicherheit dokumentieren.

```bash
node -e 'const fs=require("fs"),vm=require("vm");const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync("js/ciphers/<cipherFile>.js","utf8"),c);const x=c.window.KryptoCiphers.<cipherExport>;const r=x.crack("<cipherText>",{});const L=r.candidates||[];for(let i=1;i<L.length;i++){if((L[i-1].confidence??-Infinity)<(L[i].confidence??-Infinity))throw new Error("candidate-sort-fail")}console.log("candidate-analysis-ok",L.length,r.text);'
```

Pass-Kriterium:
- Kandidaten sind verarbeitbar und Ranking ist nachvollziehbar.

## 5) Dictionary-Reranking und Fallback-Pfad

```bash
node -e 'const fs=require("fs"),vm=require("vm");const c={window:{},fetch:global.fetch,AbortController:global.AbortController,setTimeout,clearTimeout};vm.createContext(c);vm.runInContext(fs.readFileSync("js/core/dictionaryScorer.js","utf8"),c);(async()=>{const s=c.window.KryptoCore.dictionaryScorer;const r=await s.rankCandidates([{key:1,text:"hallo welt und ich",confidence:1},{key:2,text:"xqzv jkkm ptt",confidence:2}],{languageHints:["de","en"]});if(!r.bestCandidate)throw new Error("ranking-fail");console.log("dictionary-fallback-check-ok",r.apiAvailable);})().catch(e=>{console.error(e);process.exit(1)});'
```

Pass-Kriterium:
- `bestCandidate` ist stabil vorhanden.
- Bei API-Ausfall bleibt lokales Ranking funktionsfähig.

## 6) Regressions-Check

Prüfen:
1. Baseline vor Änderung speichern (`encrypt`, `decrypt`, `crack`).
2. Nach Änderung mit identischen Inputs erneut ausführen.
3. Verschlechterungen nur mit klarer fachlicher Begründung akzeptieren.

```bash
node -e 'const fs=require("fs"),vm=require("vm");const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync("js/ciphers/<cipherFile>.js","utf8"),c);const x=c.window.KryptoCiphers.<cipherExport>;const baseline={enc:x.encrypt("<plainText>",<testKey>),dec:x.decrypt("<cipherText>",<testKey>),cr:x.crack("<cipherText>",{}).text};const rerun={enc:x.encrypt("<plainText>",<testKey>),dec:x.decrypt("<cipherText>",<testKey>),cr:x.crack("<cipherText>",{}).text};if(JSON.stringify(baseline)!==JSON.stringify(rerun))throw new Error("regression-fail");console.log("regression-check-ok",baseline,rerun);'
```

Pass-Kriterium:
- Referenzfälle bleiben stabil oder sind nachweisbar verbessert.

## 7) Einbindungs-Check (Script-Reihenfolge)

```bash
node -e 'const fs=require("fs");const h=fs.readFileSync("index.html","utf8");const c=h.indexOf("js/ciphers/<cipherFile>.js");const a=h.indexOf("js/app.js");if(c>=0&&a>=0&&c<a){console.log("integration-order-ok")}else{console.error("integration-order-fail");process.exit(1)}'
```

Pass-Kriterium:
- Cipher-Script steht vor `js/app.js`.

## Abschlussregel

1. Alle sieben Bereiche müssen grün sein.
2. Bei Rot: Fehler beheben und komplette Checkliste erneut ausführen.
3. Erst freigeben, wenn alle Gates grün sind.

## Referenzen

- Core-Regeln: `AGENTS.md`
- Laufzeitpfad/Fallbacks: `docs/DATENFLUSS.md`
- Scoring/Ranking: `docs/SCORING.md`
- Cipher-Vertrag: `js/ciphers/AGENTS.md`
