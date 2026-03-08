import { makeResult, parseArgs, printResult, readRepoText } from "./_shared.mjs";

function extractScriptOrder(html) {
  const matches = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map((m) => m[1]);
  return matches;
}

function extractExtensions(fileParsersSource) {
  const matches = [...fileParsersSource.matchAll(/extensions:\s*\[([^\]]+)\]/g)];
  const set = new Set();

  for (const match of matches) {
    const values = match[1]
      .split(",")
      .map((part) => part.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
    for (const value of values) {
      set.add(value);
    }
  }

  return Array.from(set);
}

export async function checkCodeDocConsistency() {
  const failures = [];
  const details = [];

  const [indexHtml, appJs, fileParsersJs, scoringJs, datenfluss, scoringDoc, cipherAgents] =
    await Promise.all([
      readRepoText("index.html"),
      readRepoText("js/app.js"),
      readRepoText("js/core/fileParsers.js"),
      readRepoText("js/core/dictionaryScorer.js"),
      readRepoText("docs/DATENFLUSS.md"),
      readRepoText("docs/SCORING.md"),
      readRepoText("js/ciphers/AGENTS.md"),
    ]);

  const extensions = extractExtensions(fileParsersJs);
  for (const ext of extensions) {
    if (!datenfluss.includes(`\`${ext}\``)) {
      failures.push(`docs/DATENFLUSS.md: unterstützte Extension \`${ext}\` aus fileParsers fehlt.`);
    }
  }
  details.push(`Erkannte Parser-Extensions: ${extensions.join(", ")}`);

  const mustCopyTokens = [
    "navigator.clipboard.writeText",
    'document.execCommand("copy")',
  ];

  for (const token of mustCopyTokens) {
    if (!appJs.includes(token)) {
      failures.push(`js/app.js: erwarteter Copy-Pfad fehlt: ${token}`);
    }
    if (!datenfluss.includes(token)) {
      failures.push(`docs/DATENFLUSS.md: Copy-Pfad fehlt: ${token}`);
    }
  }

  const scoringTokens = ["coverage * 20", "* 1.2", "-3.2", "base * 0.35"];
  for (const token of scoringTokens) {
    if (!scoringJs.includes(token)) {
      failures.push(`js/core/dictionaryScorer.js: Scoring-Term fehlt im Code: ${token}`);
    }
  }

  const scoringDocTokens = [
    "coverage * 20",
    "validWords * 1.2",
    "zeroPenalty = -3.2",
    "combinedScore = base * 0.35 + dictBoost + zeroPenalty",
  ];

  for (const token of scoringDocTokens) {
    if (!scoringDoc.includes(token)) {
      failures.push(`docs/SCORING.md: Scoring-Term fehlt in Doku: ${token}`);
    }
  }

  const scripts = extractScriptOrder(indexHtml);
  const appIndex = scripts.indexOf("js/app.js");
  const coreIndices = scripts
    .map((src, index) => ({ src, index }))
    .filter((entry) => entry.src.startsWith("js/core/"));
  const cipherIndices = scripts
    .map((src, index) => ({ src, index }))
    .filter((entry) => entry.src.startsWith("js/ciphers/"));

  if (appIndex < 0) {
    failures.push("index.html: js/app.js ist nicht eingebunden.");
  }

  for (const entry of coreIndices) {
    if (entry.index > appIndex) {
      failures.push(`index.html: Core-Script nach app.js: ${entry.src}`);
    }
  }

  for (const entry of cipherIndices) {
    if (entry.index > appIndex) {
      failures.push(`index.html: Cipher-Script nach app.js: ${entry.src}`);
    }
  }

  const lastCoreIndex = coreIndices.length > 0 ? Math.max(...coreIndices.map((e) => e.index)) : -1;
  const firstCipherIndex = cipherIndices.length > 0 ? Math.min(...cipherIndices.map((e) => e.index)) : -1;

  if (lastCoreIndex >= 0 && firstCipherIndex >= 0 && lastCoreIndex > firstCipherIndex) {
    failures.push("index.html: Mindestens ein Core-Script steht nach einem Cipher-Script.");
  }

  details.push(`Script-Reihenfolge: ${scripts.join(" -> ")}`);

  const cipherDocTokens = [
    "js/ciphers/caesarCipher.js",
    "js/ciphers/leetCipher.js",
    "js/ciphers/playfairCipher.js",
    "js/ciphers/vigenereCipher.js",
    "encrypt(text, key?)",
    "decrypt(text, key?)",
    "crack(text, options?)",
  ];

  for (const token of cipherDocTokens) {
    if (!cipherAgents.includes(token)) {
      failures.push(`js/ciphers/AGENTS.md: Vertrags- oder Verfahrenshinweis fehlt: ${token}`);
    }
  }

  return makeResult("code_doc_consistency", failures, details);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await checkCodeDocConsistency();

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printResult(result.name, result);
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
