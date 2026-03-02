import test from "node:test";
import assert from "node:assert/strict";
import { checkSkillAlignment } from "../../scripts/docs/check_skill_alignment.mjs";

test("skill artifacts remain aligned with core docs", async () => {
  const result = await checkSkillAlignment();
  assert.equal(result.ok, true, result.failures.join("\n"));
});
