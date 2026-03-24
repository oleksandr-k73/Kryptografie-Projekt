import fs from "node:fs/promises";
import { Bench } from "tinybench";
import {
  countWords,
  estimateTokens,
  listRepoFiles,
  makeResult,
  normalizeLine,
  parseArgs,
  printResult,
  readRepoText,
  repoPath,
  writeJson,
} from "./_shared.mjs";

const CONTEXT_FILES = [
  "AGENTS.md",
  "docs/DATENFLUSS.md",
  "docs/SCORING.md",
  "js/ciphers/AGENTS.md",
  "skills/cipher-new-method/SKILL.md",
  "skills/cipher-new-method/references/debug-checklist.md",
  "skills/cipher-new-method/agents/openai.yaml",
];

async function resolveContextFiles() {
  const discovered = new Set(await listRepoFiles(CONTEXT_FILES));
  const missing = CONTEXT_FILES.filter((filePath) => !discovered.has(filePath));
  const existing = CONTEXT_FILES.filter((filePath) => discovered.has(filePath));
  return { existing, missing };
}

async function readAll(paths) {
  await Promise.all(paths.map((filePath) => fs.readFile(repoPath(filePath), "utf8")));
}

function computeRedundancy(contents) {
  const seen = new Set();
  let total = 0;
  let duplicates = 0;

  for (const content of contents) {
    const lines = content
      .split(/\r?\n/)
      .map((line) => normalizeLine(line))
      .filter((line) => line.length >= 24);

    for (const line of lines) {
      total += 1;
      if (seen.has(line)) {
        duplicates += 1;
      } else {
        seen.add(line);
      }
    }
  }

  const ratio = total === 0 ? 0 : duplicates / total;
  return { duplicates, total, ratio };
}

async function measureLoadLatency(contextFiles, iterations) {
  const bench = new Bench({
    iterations,
    warmupIterations: Math.min(5, Math.max(0, iterations - 1)),
  });

  bench.add("read_context_docs", async () => {
    await readAll(contextFiles);
  });

  await bench.run();

  const task = bench.tasks[0];
  const latency = task?.result?.latency || {};

  return {
    iterations,
    sampleCount: latency.samplesCount || 0,
    meanLoadMs: Number(latency.mean) || 0,
    p95LoadMs: Number(latency.p95 ?? latency.p99 ?? latency.p75) || 0,
    minLoadMs: Number(latency.min) || 0,
    maxLoadMs: Number(latency.max) || 0,
  };
}

export async function benchmarkContextTokens(options = {}) {
  const iterations = Number(options.iterations || 30);
  // Der Default bleibt bewusst knapp über dem aktuellen Doku-Umfang; Rail Fence + YAML
  // erweitern den dokumentierten Vertragsraum real, ohne dass damit beliebiges Wachstum gemeint ist.
  const maxTotalTokens = Number(options.maxTotalTokens || 10500);
  const maxRedundancy = Number(options.maxRedundancy || 0.35);

  const { existing: contextFiles, missing } = await resolveContextFiles();

  const files = [];
  const contents = [];

  for (const filePath of contextFiles) {
    const content = await readRepoText(filePath);
    files.push({
      file: filePath,
      chars: content.length,
      words: countWords(content),
      estimatedTokens: estimateTokens(content),
    });
    contents.push(content);
  }

  const totalEstimatedTokens = files.reduce((acc, file) => acc + file.estimatedTokens, 0);
  const totalWords = files.reduce((acc, file) => acc + file.words, 0);
  const redundancy = computeRedundancy(contents);
  const benchmark = await measureLoadLatency(contextFiles, iterations);

  const failures = [];
  const details = [
    `totalEstimatedTokens=${totalEstimatedTokens}`,
    `totalWords=${totalWords}`,
    `redundancyRatio=${redundancy.ratio.toFixed(3)}`,
    `meanLoadMs=${benchmark.meanLoadMs.toFixed(3)}`,
  ];

  if (missing.length > 0) {
    failures.push(`Kontextdateien fehlen: ${missing.join(", ")}`);
  }

  if (totalEstimatedTokens > maxTotalTokens) {
    failures.push(`Tokenbudget überschritten: ${totalEstimatedTokens} > ${maxTotalTokens}.`);
  }

  if (redundancy.ratio > maxRedundancy) {
    failures.push(
      `Redundanzschwelle überschritten: ${redundancy.ratio.toFixed(3)} > ${maxRedundancy}.`
    );
  }

  const result = makeResult("benchmark_context_tokens", failures, details);
  result.metrics = {
    files,
    totalEstimatedTokens,
    totalWords,
    redundancy,
    benchmark,
  };

  return result;
}

function compareMetrics(current, baseline) {
  const deltaTokens = current.totalEstimatedTokens - baseline.totalEstimatedTokens;
  const deltaRedundancy = current.redundancy.ratio - baseline.redundancy.ratio;
  const deltaMeanLoadMs = current.benchmark.meanLoadMs - baseline.benchmark.meanLoadMs;

  return {
    deltaTokens,
    deltaRedundancy,
    deltaMeanLoadMs,
    tokenImprovementPct:
      baseline.totalEstimatedTokens > 0
        ? ((baseline.totalEstimatedTokens - current.totalEstimatedTokens) /
            baseline.totalEstimatedTokens) *
          100
        : 0,
    loadImprovementPct:
      baseline.benchmark.meanLoadMs > 0
        ? ((baseline.benchmark.meanLoadMs - current.benchmark.meanLoadMs) /
            baseline.benchmark.meanLoadMs) *
          100
        : 0,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await benchmarkContextTokens({
    iterations: args.iterations,
    maxTotalTokens: args.maxTotalTokens,
    maxRedundancy: args.maxRedundancy,
  });

  if (args.compare) {
    const baselineRaw = await fs.readFile(repoPath(args.compare), "utf8");
    const baseline = JSON.parse(baselineRaw);
    result.comparison = compareMetrics(result.metrics, baseline.metrics || baseline);
  }

  if (args.out) {
    await writeJson(args.out, {
      createdAt: new Date().toISOString(),
      ...result,
    });
  }

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printResult(result.name, result);
    if (result.comparison) {
      console.log(`  - deltaTokens=${result.comparison.deltaTokens}`);
      console.log(`  - deltaRedundancy=${result.comparison.deltaRedundancy.toFixed(4)}`);
      console.log(`  - deltaMeanLoadMs=${result.comparison.deltaMeanLoadMs.toFixed(4)}`);
    }
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
