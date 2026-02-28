import { describe, expect, it } from "vitest";
import { checkDocContracts } from "../../scripts/docs/check_doc_contracts.mjs";
import { checkCodeDocConsistency } from "../../scripts/docs/check_code_doc_consistency.mjs";
import { checkProgressiveDisclosure } from "../../scripts/docs/check_progressive_disclosure.mjs";
import { checkSkillAlignment } from "../../scripts/docs/check_skill_alignment.mjs";
import { benchmarkContextTokens } from "../../scripts/docs/benchmark_context_tokens.mjs";

describe("docs quality gates", () => {
  it("passes document contracts", async () => {
    const result = await checkDocContracts();
    expect(result.ok, result.failures.join("\n")).toBe(true);
  });

  it("passes code/doc consistency", async () => {
    const result = await checkCodeDocConsistency();
    expect(result.ok, result.failures.join("\n")).toBe(true);
  });

  it("passes progressive disclosure and skill alignment", async () => {
    const disclosure = await checkProgressiveDisclosure();
    expect(disclosure.ok, disclosure.failures.join("\n")).toBe(true);

    const skill = await checkSkillAlignment();
    expect(skill.ok, skill.failures.join("\n")).toBe(true);
  });

  it("stays within context benchmark thresholds", async () => {
    const result = await benchmarkContextTokens({ iterations: 8 });
    expect(result.ok, result.failures.join("\n")).toBe(true);
    expect(result.metrics.totalEstimatedTokens).toBeGreaterThan(0);
  });
});
