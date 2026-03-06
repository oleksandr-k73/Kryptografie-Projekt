import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fg from "fast-glob";
import { countTokens } from "gpt-tokenizer";

const thisDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(thisDir, "../..");

export function repoPath(...segments) {
  return path.join(repoRoot, ...segments);
}

export async function readRepoText(relativePath) {
  return fs.readFile(repoPath(relativePath), "utf8");
}

export async function readRepoJson(relativePath) {
  const raw = await readRepoText(relativePath);
  return JSON.parse(raw);
}

export async function listRepoFiles(patterns, options = {}) {
  return fg(patterns, {
    cwd: repoRoot,
    dot: false,
    onlyFiles: true,
    ...options,
  });
}

export function estimateTokens(text) {
  if (!text) {
    return 0;
  }

  try {
    return countTokens(text);
  } catch (_error) {
    return Math.ceil(text.length / 4);
  }
}

export function countWords(text) {
  const parts = (text || "").trim().split(/\s+/).filter(Boolean);
  return parts.length;
}

export function normalizeLine(line) {
  return line.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizedLineSet(text, minLength = 0) {
  const lines = (text || "")
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter((line) => line.length >= minLength);
  return new Set(lines);
}

export function overlapRatio(setA, setB) {
  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const value of setA) {
    if (setB.has(value)) {
      overlap += 1;
    }
  }

  const smaller = Math.min(setA.size, setB.size);
  return smaller === 0 ? 0 : overlap / smaller;
}

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith("--")) {
      continue;
    }
    const key = value.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

export function printResult(name, result) {
  const status = result.ok ? "PASS" : "FAIL";
  console.log(`[${status}] ${name}`);

  if (result.details && result.details.length > 0) {
    for (const line of result.details) {
      console.log(`  - ${line}`);
    }
  }

  if (!result.ok && result.failures && result.failures.length > 0) {
    for (const line of result.failures) {
      console.log(`  * ${line}`);
    }
  }
}

export async function writeJson(relativeOrAbsolutePath, data) {
  const target = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : repoPath(relativeOrAbsolutePath);

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function makeResult(name, failures = [], details = []) {
  return {
    name,
    ok: failures.length === 0,
    failures,
    details,
  };
}
