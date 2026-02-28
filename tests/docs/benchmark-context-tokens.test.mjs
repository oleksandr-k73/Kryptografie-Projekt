import test from "node:test";
import assert from "node:assert/strict";
import { benchmarkContextTokens } from "../../scripts/docs/benchmark_context_tokens.mjs";

test("context benchmark stays within configured limits", async () => {
  const result = await benchmarkContextTokens({ iterations: 8 });
  assert.equal(result.ok, true, result.failures.join("\n"));
  assert.ok(result.metrics.totalEstimatedTokens > 0);
  assert.ok(result.metrics.benchmark.meanLoadMs >= 0);
});
