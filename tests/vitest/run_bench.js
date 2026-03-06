#!/usr/bin/env node

/**
 * Seeded Benchmark-Runner für Vigenère.
 *
 * Warum eigener Runner statt Test? Damit Stage-A/B/C/D reproduzierbar als JSON
 * gespeichert werden können und hinted/unhinted direkt vergleichbar bleiben.
 */

const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const { generateVigenereDataset } = require("./generators/vigenereDataset.js");

class MiniWindow {
  constructor() {
    this.KryptoCiphers = {};
  }
}

function loadVigenereCipher() {
  global.window = new MiniWindow();
  const cipherPath = path.join(__dirname, "../../", "js", "ciphers", "vigenereCipher.js");
  const cipherCode = fs.readFileSync(cipherPath, "utf-8");
  // Legacy-Setup nutzt klassische Script-Einbindung; eval simuliert diesen Browser-Pfad in Node.
  eval(cipherCode);
  return global.window.KryptoCiphers.vigenereCipher;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[i + 1];
    if (value == null || value.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = value;
    i += 1;
  }
  return args;
}

function parseOptimizations(value) {
  if (value == null) {
    return false;
  }
  if (value === true || value === "true") {
    return true;
  }
  if (value === false || value === "false") {
    return false;
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed === true || parsed === false || (parsed && typeof parsed === "object")) {
      return parsed;
    }
  } catch (err) {
    // Fallthrough: einfache Key=Value-Strings sind kein supported input format.
  }

  throw new Error(
    "--optimizations erwartet true|false oder ein JSON-Objekt, z. B. '{\"memoChi\":true}'."
  );
}

function normalizeLetters(value) {
  return String(value || "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
}

function percentile(sortedTimes, ratio) {
  if (sortedTimes.length === 0) {
    return 0;
  }
  const index = Math.min(
    sortedTimes.length - 1,
    Math.max(0, Math.floor(sortedTimes.length * ratio))
  );
  return sortedTimes[index];
}

function summarizeMode(modeName, cases, optionFlags) {
  const times = cases.map((entry) => entry.timeMs).sort((a, b) => a - b);
  const totalMs = times.reduce((sum, value) => sum + value, 0);
  const successCount = cases.filter((entry) => entry.success).length;
  const failureCount = cases.length - successCount;
  const statesGenerated = cases.reduce((sum, entry) => sum + (entry.statesGenerated || 0), 0);
  const statesEvaluated = cases.reduce((sum, entry) => sum + (entry.statesEvaluated || 0), 0);
  const optionCount = cases.reduce((sum, entry) => sum + (entry.optionCount || 0), 0);

  return {
    mode: modeName,
    flags: optionFlags,
    avgMs: Number((totalMs / Math.max(1, cases.length)).toFixed(3)),
    p50: Number(percentile(times, 0.5).toFixed(3)),
    p95: Number(percentile(times, 0.95).toFixed(3)),
    totalMs: Number(totalMs.toFixed(1)),
    totalHours: Number((totalMs / 3.6e6).toFixed(6)),
    successRate: Number((successCount / Math.max(1, cases.length)).toFixed(4)),
    successCount,
    failureCount,
    statesGenerated,
    statesEvaluated,
    optionCount,
    caseCount: cases.length,
  };
}

function runMode(cipher, dataset, mode, optimizations) {
  const cases = [];

  for (let index = 0; index < dataset.length; index += 1) {
    const testCase = dataset[index];
    const crackOptions = mode === "hinted"
      ? { keyLength: testCase.keyLength, optimizations }
      : { optimizations };

    const startedAt = performance.now();
    let cracked;
    let error = null;
    try {
      cracked = cipher.crack(testCase.ciphertext, crackOptions);
    } catch (err) {
      error = err;
    }
    const elapsed = performance.now() - startedAt;

    if (error) {
      cases.push({
        id: testCase.id,
        timeMs: elapsed,
        success: false,
        error: error.message,
      });
      continue;
    }

    const expectedPlain = normalizeLetters(testCase.plaintext);
    const foundPlain = normalizeLetters(cracked.text);
    const success = foundPlain === expectedPlain;

    const search = cracked.search || {};
    cases.push({
      id: testCase.id,
      timeMs: elapsed,
      success,
      expectedKey: testCase.key,
      foundKey: cracked.key,
      statesGenerated: Number(search.statesGenerated || 0),
      statesEvaluated: Number(search.statesEvaluated || 0),
      optionCount: Number(search.optionCount || 0),
    });

    const chunkSize = Math.max(1, Math.floor(dataset.length / 10));
    if ((index + 1) % chunkSize === 0) {
      console.log(
        `[${mode}] ${index + 1}/${dataset.length} | ${elapsed.toFixed(1)}ms | ${success ? "OK" : "FAIL"}`
      );
    }
  }

  return cases;
}

function buildOutput(seed, n, optimizations, hintedSummary, unhintedSummary) {
  const mergedTotalMs = hintedSummary.totalMs + unhintedSummary.totalMs;
  const mergedCases = hintedSummary.caseCount + unhintedSummary.caseCount;
  const mergedSuccess = hintedSummary.successCount + unhintedSummary.successCount;
  const mergedFailure = hintedSummary.failureCount + unhintedSummary.failureCount;

  return {
    seed,
    n,
    flags: optimizations,
    hinted: hintedSummary,
    unhinted: unhintedSummary,
    avgMs: Number((mergedTotalMs / Math.max(1, mergedCases)).toFixed(3)),
    p50: Number(((hintedSummary.p50 + unhintedSummary.p50) / 2).toFixed(3)),
    p95: Number(((hintedSummary.p95 + unhintedSummary.p95) / 2).toFixed(3)),
    totalMs: Number(mergedTotalMs.toFixed(1)),
    totalHours: Number((mergedTotalMs / 3.6e6).toFixed(6)),
    successRate: Number((mergedSuccess / Math.max(1, mergedCases)).toFixed(4)),
    successCount: mergedSuccess,
    failureCount: mergedFailure,
    statesGenerated: hintedSummary.statesGenerated + unhintedSummary.statesGenerated,
    statesEvaluated: hintedSummary.statesEvaluated + unhintedSummary.statesEvaluated,
    optionCount: hintedSummary.optionCount + unhintedSummary.optionCount,
    notes: "hinted+unhinted benchmark, success based on normalized plaintext recovery",
    timestamp: new Date().toISOString(),
  };
}

function main() {
  const args = parseArgs(process.argv);
  const seed = Number.parseInt(args.seed || "42", 10);
  const n = Number.parseInt(args.n || "100", 10);
  const outPath = args.out || "tests/vitest/fixtures/bench-results/bench.json";
  const optimizations = parseOptimizations(args.optimizations);

  if (!Number.isFinite(seed) || !Number.isFinite(n) || n <= 0) {
    throw new Error("Ungültige CLI-Parameter: --seed und --n müssen valide Zahlen sein.");
  }

  const dataset = generateVigenereDataset(n, seed);
  const cipher = loadVigenereCipher();

  console.log(`\\n=== Vigenère Bench ===\\nseed=${seed}\\nn=${n}\\noptimizations=${JSON.stringify(optimizations)}\\n`);

  const hintedCases = runMode(cipher, dataset, "hinted", optimizations);
  const hintedSummary = summarizeMode("hinted", hintedCases, optimizations);

  const unhintedCases = runMode(cipher, dataset, "unhinted", optimizations);
  const unhintedSummary = summarizeMode("unhinted", unhintedCases, optimizations);

  const output = buildOutput(seed, n, optimizations, hintedSummary, unhintedSummary);

  const targetDir = path.dirname(outPath);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf-8");

  console.log("\\n=== Summary ===");
  console.log(`hinted:   ${(hintedSummary.successRate * 100).toFixed(1)}% | avg ${hintedSummary.avgMs.toFixed(2)}ms`);
  console.log(`unhinted: ${(unhintedSummary.successRate * 100).toFixed(1)}% | avg ${unhintedSummary.avgMs.toFixed(2)}ms`);
  console.log(`totalHours=${output.totalHours.toFixed(4)} | out=${outPath}`);
}

main();
