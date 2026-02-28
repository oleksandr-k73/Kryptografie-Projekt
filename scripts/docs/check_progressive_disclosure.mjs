import {
  countWords,
  makeResult,
  normalizedLineSet,
  overlapRatio,
  parseArgs,
  printResult,
  readRepoText,
} from "./_shared.mjs";

const DETAIL_FILES = ["docs/DATENFLUSS.md", "docs/SCORING.md", "js/ciphers/AGENTS.md"];

export async function checkProgressiveDisclosure() {
  const failures = [];
  const details = [];

  const agents = await readRepoText("AGENTS.md");
  const detailContents = await Promise.all(DETAIL_FILES.map((file) => readRepoText(file)));

  if (!agents.includes("## 5) Dokumentationslandkarte")) {
    failures.push("AGENTS.md: Abschnitt 'Dokumentationslandkarte' fehlt.");
  }

  for (const file of DETAIL_FILES) {
    if (!agents.includes(file)) {
      failures.push(`AGENTS.md: Detaildokument ist nicht referenziert: ${file}`);
    }
  }

  const agentsWords = countWords(agents);
  const detailWords = detailContents.map((content) => countWords(content));
  const detailSum = detailWords.reduce((acc, value) => acc + value, 0);

  if (agentsWords > detailSum * 0.8) {
    failures.push(
      `AGENTS.md ist zu ausführlich für Root-Ebene (${agentsWords} Wörter vs ${detailSum} in Details).`
    );
  }

  const agentsSet = normalizedLineSet(agents, 24);
  const maxOverlap = 0.45;

  for (let i = 0; i < DETAIL_FILES.length; i += 1) {
    const file = DETAIL_FILES[i];
    const content = detailContents[i];
    const detailSet = normalizedLineSet(content, 24);
    const ratio = overlapRatio(agentsSet, detailSet);

    details.push(`${file}: Overlap ${ratio.toFixed(3)}`);

    if (ratio > maxOverlap) {
      failures.push(
        `${file}: Redundanz zu hoch gegenüber AGENTS.md (${ratio.toFixed(3)} > ${maxOverlap}).`
      );
    }

    const hasGoal = content.includes("## Ziel") || content.includes("## Zweck");
    if (!hasGoal) {
      failures.push(`${file}: Ziel-/Zweck-Abschnitt fehlt.`);
    }
  }

  return makeResult("progressive_disclosure", failures, details);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await checkProgressiveDisclosure();

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
