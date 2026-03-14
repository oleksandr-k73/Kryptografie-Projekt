import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const THIS_FILE = fileURLToPath(import.meta.url);
const THIS_DIR = path.dirname(THIS_FILE);
const ROOT_DIR = path.resolve(THIS_DIR, "../..");

function normalizeHarnessScriptPaths(scriptPaths) {
  const normalizedPaths = [];
  for (const relativePath of scriptPaths) {
    // Die Harness-Injektion hält die Script-Reihenfolge konsistent mit index.html,
    // damit dictionaryScorer-Tests dasselbe Offline-Sprachartifact sehen wie die Browser-Laufzeit.
    if (
      relativePath === "js/core/dictionaryScorer.js" &&
      !normalizedPaths.includes("js/core/segmentLexiconData.js")
    ) {
      normalizedPaths.push("js/core/segmentLexiconData.js");
    }
    normalizedPaths.push(relativePath);
  }
  return normalizedPaths;
}

export function loadScriptsIntoContext(context, scriptPaths) {
  for (const relativePath of normalizeHarnessScriptPaths(scriptPaths)) {
    const absolutePath = path.resolve(ROOT_DIR, relativePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Test-Setup fehlgeschlagen: Skript nicht gefunden: ${relativePath}`);
    }

    let source;
    try {
      source = fs.readFileSync(absolutePath, "utf8");
    } catch (error) {
      throw new Error(
        `Test-Setup fehlgeschlagen: Skript konnte nicht geladen werden: ${relativePath} (${error.message})`
      );
    }

    try {
      vm.runInContext(source, context, { filename: absolutePath });
    } catch (error) {
      throw new Error(
        `Test-Setup fehlgeschlagen: Skript konnte nicht ausgeführt werden: ${relativePath} (${error.message})`
      );
    }
  }
}

export function loadBrowserContext(scriptPaths, options = {}) {
  const fetchImpl =
    options.fetchImpl ||
    (() => Promise.reject(new Error("fetch disabled in tests")));

  const context = {
    window: {},
    console,
    fetch: fetchImpl,
    AbortController,
    setTimeout,
    clearTimeout,
  };
  context.window.window = context.window;
  vm.createContext(context);
  loadScriptsIntoContext(context, scriptPaths);

  return context.window;
}
