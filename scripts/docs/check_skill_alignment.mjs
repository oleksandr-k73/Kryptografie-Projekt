import { makeResult, parseArgs, printResult, readRepoJson, readRepoText } from "./_shared.mjs";

function includesInOrder(haystack, snippets) {
  let start = 0;
  for (const snippet of snippets) {
    const index = haystack.indexOf(snippet, start);
    if (index < 0) {
      return false;
    }
    start = index + snippet.length;
  }
  return true;
}

export async function checkSkillAlignment() {
  const failures = [];
  const details = [];

  const [skill, checklist, promptYaml, scenarios] = await Promise.all([
    readRepoText("skills/cipher-new-method/SKILL.md"),
    readRepoText("skills/cipher-new-method/references/debug-checklist.md"),
    readRepoText("skills/cipher-new-method/agents/openai.yaml"),
    readRepoJson("tests/docs/fixtures/behavior-scenarios.json"),
  ]);

  const requiredOrder = [
    "AGENTS.md",
    "docs/DATENFLUSS.md",
    "docs/SCORING.md",
    "js/ciphers/AGENTS.md",
  ];

  if (!includesInOrder(skill, requiredOrder)) {
    failures.push("SKILL.md: verbindliche Doku-Reihenfolge fehlt oder ist nicht geordnet.");
  }

  const skillTokens = [
    "Cipher-Vertrag",
    "Crack-Rückgabeform",
    "Dictionary-Reranking",
    "Fallback",
    "CipherRegistry.register",
  ];

  for (const token of skillTokens) {
    if (!skill.includes(token) && !checklist.includes(token)) {
      failures.push(`Skill-Artefakte: Pflichtbegriff fehlt: ${token}`);
    }
  }

  const checklistSections = (checklist.match(/^## [1-7]\)/gm) || []).length;
  if (checklistSections !== 7) {
    failures.push(
      `debug-checklist.md: Erwartet 7 nummerierte Hauptchecks (gefunden: ${checklistSections}).`
    );
  }

  const checklistRefs = [
    "AGENTS.md",
    "docs/DATENFLUSS.md",
    "docs/SCORING.md",
    "js/ciphers/AGENTS.md",
  ];

  for (const ref of checklistRefs) {
    if (!checklist.includes(ref)) {
      failures.push(`debug-checklist.md: Referenz fehlt: ${ref}`);
    }
  }

  const promptLineMatch = promptYaml.match(/default_prompt:\s*"([\s\S]+)"\s*$/m);
  const prompt = promptLineMatch ? promptLineMatch[1] : "";

  if (!prompt) {
    failures.push("agents/openai.yaml: default_prompt fehlt.");
  } else if (!includesInOrder(prompt, requiredOrder)) {
    failures.push("agents/openai.yaml: Doku-Reihenfolge fehlt im default_prompt.");
  }

  const combinedCorpus = `${skill}\n${checklist}\n${prompt}`.toLowerCase();
  for (const scenario of scenarios) {
    const missing = (scenario.requiredKeywords || []).filter(
      (keyword) => !combinedCorpus.includes(String(keyword).toLowerCase())
    );

    if (missing.length > 0) {
      failures.push(
        `Szenario '${scenario.id}': Schlüsselbegriffe fehlen: ${missing.join(", ")}`
      );
    } else {
      details.push(`Szenario '${scenario.id}' vollständig abgedeckt.`);
    }
  }

  return makeResult("skill_alignment", failures, details);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await checkSkillAlignment();

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
