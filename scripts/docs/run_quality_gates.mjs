import { checkDocContracts } from "./check_doc_contracts.mjs";
import { checkCodeDocConsistency } from "./check_code_doc_consistency.mjs";
import { checkProgressiveDisclosure } from "./check_progressive_disclosure.mjs";
import { checkSkillAlignment } from "./check_skill_alignment.mjs";
import { benchmarkContextTokens } from "./benchmark_context_tokens.mjs";
import { parseArgs, printResult, writeJson } from "./_shared.mjs";

export async function runQualityGates(options = {}) {
  const results = [];

  results.push(await checkDocContracts());
  results.push(await checkCodeDocConsistency());
  results.push(await checkProgressiveDisclosure());
  results.push(await checkSkillAlignment());

  const benchmark = await benchmarkContextTokens({
    iterations: options.iterations,
    maxTotalTokens: options.maxTotalTokens,
    maxRedundancy: options.maxRedundancy,
  });
  results.push(benchmark);

  const ok = results.every((result) => result.ok);
  return {
    ok,
    results,
    benchmark,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = await runQualityGates({
    iterations: args.iterations,
    maxTotalTokens: args.maxTotalTokens,
    maxRedundancy: args.maxRedundancy,
  });

  for (const result of summary.results) {
    printResult(result.name, result);
  }

  if (args.benchmarkOut) {
    await writeJson(args.benchmarkOut, {
      createdAt: new Date().toISOString(),
      ...summary.benchmark,
    });
  }

  if (args.out) {
    await writeJson(args.out, {
      createdAt: new Date().toISOString(),
      ...summary,
    });
  }

  if (!summary.ok) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
