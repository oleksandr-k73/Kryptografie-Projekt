import test from "node:test";
import assert from "node:assert/strict";
import { checkCodeDocConsistency } from "../../scripts/docs/check_code_doc_consistency.mjs";

test("code and docs stay consistent", async () => {
  const result = await checkCodeDocConsistency();
  assert.equal(result.ok, true, result.failures.join("\n"));
});
