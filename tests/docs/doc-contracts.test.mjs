import test from "node:test";
import assert from "node:assert/strict";
import { checkDocContracts } from "../../scripts/docs/check_doc_contracts.mjs";

test("doc contracts are satisfied", async () => {
  const result = await checkDocContracts();
  assert.equal(result.ok, true, result.failures.join("\n"));
});
