const fs = require('fs');
const path = require('path');
const codeV = fs.readFileSync(path.join(process.cwd(),'js','ciphers','vigenereCipher.js'),'utf8');
const codeD = fs.readFileSync(path.join(process.cwd(),'js','core','dictionaryScorer.js'),'utf8');
const MiniWindow = function(){ this.KryptoCiphers = {}; this.KryptoCore = {}; };
const w = new MiniWindow(); global.window = w;
(eval)(codeV);
(eval)(codeD);
const v = window.KryptoCiphers.vigenereCipher;
const s = window.KryptoCore.dictionaryScorer;

async function printRanked(cracked, label){
  console.log('\n==',label,'==');
  console.log('search.shortTextRescue=', cracked.search && cracked.search.shortTextRescue);
  console.log('best raw:', cracked.key, cracked.text, cracked.confidence);
  const ranked = await s.rankCandidates(cracked.candidates, { languageHints: ['en'] });
  console.log('apiAvailable=', ranked.apiAvailable);
  console.log('bestCandidate:', ranked.bestCandidate ? { key: ranked.bestCandidate.key, text: ranked.bestCandidate.text, confidence: ranked.bestCandidate.confidence } : null);
  console.log('top 8 ranked:');
  ranked.rankedCandidates.slice(0,8).forEach((c,i)=>{
    console.log(i+1, c.key, c.confidence.toFixed(3), 'dictCov=', c.dictionary.coverage, 'validWords=', c.dictionary.validWords, 'localConf=', c.localConfidence.toFixed(3));
  });
}

const ciphertext = 'Zfcurbctpdqrau';
console.log('Ciphertext:', ciphertext);

(async ()=>{
  console.log('\n--- with keyLength=5 hint, optimizations=false ---');
  const c1 = v.crack(ciphertext, { keyLength: 5, optimizations: false });
  await printRanked(c1, 'hinted,false');

  console.log('\n--- with keyLength=5 hint, optimizations=true ---');
  const c2 = v.crack(ciphertext, { keyLength: 5, optimizations: true });
  await printRanked(c2, 'hinted,true');

  console.log('\n--- without hint, optimizations=true ---');
  const c3 = v.crack(ciphertext, { optimizations: true });
  await printRanked(c3, 'unhinted,true');

  console.log('\n--- without hint, optimizations=false ---');
  const c4 = v.crack(ciphertext, { optimizations: false });
  await printRanked(c4, 'unhinted,false');
})();
