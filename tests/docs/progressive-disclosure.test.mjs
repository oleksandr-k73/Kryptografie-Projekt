import test from "node:test";
import assert from "node:assert/strict";
import { checkProgressiveDisclosure } from "../../scripts/docs/check_progressive_disclosure.mjs";

test("progressive disclosure constraints hold", async () => {
  const result = await checkProgressiveDisclosure();
  assert.equal(result.ok, true, result.failures.join("\n"));
});
