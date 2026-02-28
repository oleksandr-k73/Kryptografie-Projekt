import { makeResult, parseArgs, printResult, readRepoJson, readRepoText } from "./_shared.mjs";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import YAML from "yaml";

function nodeText(node) {
  if (!node) {
    return "";
  }

  if (typeof node.value === "string") {
    return node.value;
  }

  if (!Array.isArray(node.children)) {
    return "";
  }

  return node.children.map((child) => nodeText(child)).join("");
}

function collectHeadings(content) {
  const tree = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .parse(content);

  const headings = [];
  const queue = [tree];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (current.type === "heading") {
      const hashes = "#".repeat(current.depth || 1);
      headings.push(`${hashes} ${nodeText(current).trim()}`.trim());
    }

    if (Array.isArray(current.children)) {
      for (const child of current.children) {
        queue.push(child);
      }
    }
  }

  return headings;
}

function normalizeHeading(value) {
  return String(value || "")
    .replace(/`/g, "")
    .trim();
}

function parseYamlFrontmatter(content) {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    return null;
  }

  return YAML.parse(frontmatterMatch[1]);
}

export async function checkDocContracts() {
  const fixture = await readRepoJson("tests/docs/fixtures/doc-contracts.json");
  const failures = [];
  const details = [];

  for (const [filePath, contract] of Object.entries(fixture)) {
    const content = await readRepoText(filePath);
    const headings = filePath.endsWith(".md") ? collectHeadings(content) : [];

    const normalizedHeadings = new Set(headings.map((heading) => normalizeHeading(heading)));

    for (const heading of contract.requiredHeadings || []) {
      if (!normalizedHeadings.has(normalizeHeading(heading))) {
        failures.push(`${filePath}: Pflichtüberschrift fehlt: ${heading}`);
      }
    }

    for (const token of contract.mustContain || []) {
      if (!content.includes(token)) {
        failures.push(`${filePath}: Pflichtinhalt fehlt: ${token}`);
      }
    }

    details.push(`${filePath}: ${content.split(/\r?\n/).length} Zeilen geprüft`);
  }

  const agents = await readRepoText("AGENTS.md");
  const badExampleCount = (agents.match(/^- Schlecht:/gm) || []).length;
  const betterExampleCount = (agents.match(/^  Besser:/gm) || []).length;

  if (badExampleCount !== 2 || betterExampleCount !== 2) {
    failures.push(
      `AGENTS.md: Coding-Stil muss exakt 2 Schlecht/Besser-Paare enthalten (gefunden: ${badExampleCount}/${betterExampleCount}).`
    );
  }

  const datenfluss = await readRepoText("docs/DATENFLUSS.md");
  const scoring = await readRepoText("docs/SCORING.md");

  if (!datenfluss.startsWith("---\n")) {
    failures.push("docs/DATENFLUSS.md: Frontmatter-Block fehlt am Dateianfang.");
  } else {
    try {
      const parsed = parseYamlFrontmatter(datenfluss);
      if (!parsed || typeof parsed !== "object") {
        failures.push("docs/DATENFLUSS.md: Frontmatter ist kein valides YAML-Objekt.");
      }
    } catch (error) {
      failures.push(`docs/DATENFLUSS.md: Frontmatter-YAML ungültig (${error.message}).`);
    }
  }

  if (!scoring.startsWith("---\n")) {
    failures.push("docs/SCORING.md: Frontmatter-Block fehlt am Dateianfang.");
  } else {
    try {
      const parsed = parseYamlFrontmatter(scoring);
      if (!parsed || typeof parsed !== "object") {
        failures.push("docs/SCORING.md: Frontmatter ist kein valides YAML-Objekt.");
      }
    } catch (error) {
      failures.push(`docs/SCORING.md: Frontmatter-YAML ungültig (${error.message}).`);
    }
  }

  return makeResult("doc_contracts", failures, details);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await checkDocContracts();

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
