import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const THIS_FILE = fileURLToPath(import.meta.url);
const THIS_DIR = path.dirname(THIS_FILE);
const ROOT_DIR = path.resolve(THIS_DIR, "../..");

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

  for (const relativePath of scriptPaths) {
    const absolutePath = path.resolve(ROOT_DIR, relativePath);
    const source = fs.readFileSync(absolutePath, "utf8");
    vm.runInContext(source, context, { filename: absolutePath });
  }

  return context.window;
}
