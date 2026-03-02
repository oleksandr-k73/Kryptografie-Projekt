import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadBrowserContext } from "./_browserHarness.mjs";

const THIS_FILE = fileURLToPath(import.meta.url);
const THIS_DIR = path.dirname(THIS_FILE);
const ROOT_DIR = path.resolve(THIS_DIR, "../..");

function loadRuntime(fetchImpl) {
  const window = loadBrowserContext(
    ["js/ciphers/vigenereCipher.js", "js/core/dictionaryScorer.js"],
    { fetchImpl }
  );
  return {
    vigenere: window.KryptoCiphers.vigenereCipher,
    scorer: window.KryptoCore.dictionaryScorer,
  };
}

function loadVigenereVmContext(fetchImpl) {
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
  const source = fs.readFileSync(path.resolve(ROOT_DIR, "js/ciphers/vigenereCipher.js"), "utf8");
  vm.runInContext(source, context, {
    filename: path.resolve(ROOT_DIR, "js/ciphers/vigenereCipher.js"),
  });
  return context;
}

describe("feature proposals regression checks with markdown references", () => {
  it(
    "docs/SCORING.md + js/ciphers/AGENTS.md: unhinted fallback can run and is limited by adaptive-size gate",
    () => {
      const { vigenere } = loadRuntime(() => Promise.reject(new Error("offline")));
      const text = "OLIXGLUPCHBO";

      const allowed = vigenere.crack(text, {
        optimizations: false,
        bruteforceFallback: { maxTotalMs: 2_000, maxMsPerLength: 800 },
      });
      expect(allowed.search.bruteforceFallbackTriggered).toBe(true);
      expect(allowed.search.bruteforceFallbackReason).toBe("short_text_low_sense_keylength_gate");
      expect(Number.isInteger(allowed.search.bruteforceFallbackKeyLength)).toBe(true);

      // Niedriges maxMsPerLength erzwingt hier den neuen adaptiven Gate-Pfad ohne KeyLength-Hint.
      const blocked = vigenere.crack(text, {
        optimizations: false,
        bruteforceFallback: { maxTotalMs: 2_000, maxMsPerLength: 1 },
      });
      expect(blocked.search.bruteforceFallbackTriggered).toBe(false);
      expect(blocked.search.bruteforceFallbackReason).toBe("adaptive_size_gate_not_met");
    },
    20_000
  );

  it("docs/SCORING.md: API reachability probes all language hints and not just the first", async () => {
    const requestedUrls = [];
    const fetchMock = async (url) => {
      requestedUrls.push(String(url));
      if (String(url).endsWith("/entries/de/test")) {
        throw new Error("de probe failed");
      }
      if (String(url).endsWith("/entries/en/test")) {
        return { ok: true };
      }
      return { ok: false };
    };
    const { scorer } = loadRuntime(fetchMock);

    const ranked = await scorer.rankCandidates(
      [{ key: "X", text: "qzxv plm", confidence: 0.7 }],
      { languageHints: ["de", "en"] }
    );

    expect(requestedUrls.some((url) => url.includes("/entries/de/test"))).toBe(true);
    expect(requestedUrls.some((url) => url.includes("/entries/en/test"))).toBe(true);
    expect(ranked.apiAvailable).toBe(true);
  });

  it("docs/DATENFLUSS.md: apiAvailable is false when probes/results fail even though fetch exists", async () => {
    const { scorer } = loadRuntime(async () => {
      throw new Error("network unavailable");
    });
    const ranked = await scorer.rankCandidates(
      [{ key: "X", text: "hello world", confidence: 0.7 }],
      { languageHints: ["en"] }
    );
    expect(ranked.apiAvailable).toBe(false);
  });

  it("docs/SCORING.md: API rescoring uses raw confidence and avoids double damping", async () => {
    const fetchMock = async (url) => {
      if (String(url).endsWith("/entries/en/test")) {
        return { ok: true };
      }
      // Alle Wortchecks liefern 'invalid', bleiben aber API-seitig erreichbar.
      return { ok: false };
    };
    const { scorer } = loadRuntime(fetchMock);

    const ranked = await scorer.rankCandidates(
      [{ key: "RAW", text: "qzxv plm", confidence: 100 }],
      { languageHints: ["en"] }
    );
    const best = ranked.bestCandidate;

    expect(best.rawConfidence).toBe(100);
    // Bei Double-Damping läge der Score hier nahe 9; mit Rohscore bleibt er > 25.
    expect(best.confidence).toBeGreaterThan(25);
    expect(best.confidence).toBeLessThan(40);
  });

  it("AGENTS.md + docs/DATENFLUSS.md: fallback status string is defensively formatted in app.js", () => {
    const appSource = fs.readFileSync(path.resolve(ROOT_DIR, "js/app.js"), "utf8");

    expect(appSource.includes("Number.isFinite(search && search.bruteforceFallbackKeyLength)")).toBe(
      true
    );
    expect(appSource.includes("Number.isFinite(search && search.bruteforceCombosVisited)")).toBe(
      true
    );
    expect(appSource.includes("Number.isFinite(search && search.bruteforceElapsedMs)")).toBe(true);
    expect(appSource.includes('fallbackKeyLength == null ? "unbekannt" : fallbackKeyLength')).toBe(
      true
    );
    expect(appSource.includes("Math.max(0, Math.round(search.bruteforceElapsedMs))")).toBe(true);
  });

  it("js/ciphers/AGENTS.md + docs/SCORING.md: hinted keyLength=5 enters exhaustive branch with 26^5 cap", () => {
    const context = loadVigenereVmContext(() => Promise.reject(new Error("offline")));
    // Math.pow wird nur in diesem isolierten VM-Kontext gedrosselt, damit wir die
    // 5er-Exhaustive-Branch deterministisch und schnell testen können.
    vm.runInContext(
      `
      const __origPow = Math.pow.bind(Math);
      Math.pow = (a, b) => (a === 26 && b === 5 ? 64 : __origPow(a, b));
      `,
      context
    );
    const vigenere = context.window.KryptoCiphers.vigenereCipher;
    const cracked = vigenere.crack("ABCDE", {
      keyLength: 5,
      optimizations: false,
    });

    expect(cracked.search.exhaustive).toBe(true);
    expect(cracked.search.combos).toBe(64);
  });
});
