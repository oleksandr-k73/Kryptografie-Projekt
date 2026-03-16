import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

function loadRuntime() {
  const window = loadBrowserContext([
    "js/core/segmentLexiconData.js",
    "js/core/dictionaryScorer.js",
  ]);
  return {
    scorer: window.KryptoCore.dictionaryScorer,
  };
}

function buildModel() {
  // Kontrolliertes Domain-Set hält die Tests deterministisch, ohne auf das große Lexikon zu fallen.
  return {
    domainWords: new Set([
      "photoeffekt",
      "photo",
      "effekt",
      "daten",
      "messreihe",
      "fehler",
      "unschaerfe",
      "ort",
      "mit",
      "laser",
      "gitter",
    ]),
  };
}

describe("dictionaryScorer mergeDomainDisplayTokenTexts", () => {
  let scorer;
  let merge;
  let model;

  beforeEach(() => {
    const runtime = loadRuntime();
    scorer = runtime.scorer;
    merge = scorer.__testHooks.mergeDomainDisplayTokenTexts;
    model = buildModel();
  });

  it("returns non-array or empty inputs unchanged", () => {
    // Der Hook soll Edge-Inputs defensiv durchreichen, damit Anzeige-Token stabil bleiben.
    expect(merge(null, model)).toBe(null);
    expect(merge(undefined, model)).toBe(undefined);
    expect(merge([], model)).toEqual([]);
  });

  it("skips merging when domainWords are missing or empty", () => {
    const tokens = ["QZXVBNM"];

    // Ohne explizite Domain-Wörter soll der Hook keine unerwarteten Änderungen erzwingen.
    expect(merge(tokens, {})).toEqual(tokens);
    expect(merge(tokens, { domainWords: new Set() })).toEqual(tokens);
  });

  it("respects the >=4 prefix boundary for bridge splits", () => {
    // Prefix mit 3 Zeichen darf trotz Domain-Hit nicht gesplittet werden.
    expect(merge(["ORTMITLASER"], model)).toEqual(["ORTMITLASER"]);
  });

  it("applies split strategy 1 (domain prefix + bridge word)", () => {
    // Bridge-Splits sind wichtig, damit Fachkomposita lesbar bleiben.
    expect(merge(["MESSREIHEMITFEHLER"], model)).toEqual(["MESSREIHE", "MIT", "FEHLER"]);
  });

  it("applies split strategy 2 (domain prefix + bridge + short exact)", () => {
    // Short-Exact-Splits dürfen nur mit Domain-Präfix stattfinden, damit die Anzeige nicht zerfällt.
    expect(merge(["UNSCHAERFEIMORT"], model)).toEqual(["UNSCHAERFE", "IM", "ORT"]);
  });

  it("applies split strategy 3 (two domain words)", () => {
    // Reine Domain-Komposita sollen als zwei sichtbare Tokens darstellbar sein.
    expect(merge(["LASERGITTER"], model)).toEqual(["LASER", "GITTER"]);
  });

  it("iterates up to the guard limit when new tokens unlock further splits", () => {
    // Erst der Bridge-Split erzeugt ein Token, das im Folgepass wieder gesplittet werden darf.
    expect(merge(["MESSREIHEMITLASERGITTER"], model)).toEqual([
      "MESSREIHE",
      "MIT",
      "LASER",
      "GITTER",
    ]);
  });

  it("merges adjacent domain tokens in the final pass", () => {
    // Anzeige darf Domain-Komposita wieder zusammenziehen, wenn sie adjazent auftauchen.
    expect(merge(["PHOTO", "EFFEKT", "DATEN"], model)).toEqual(["PHOTOEFFEKT", "DATEN"]);
  });
});
