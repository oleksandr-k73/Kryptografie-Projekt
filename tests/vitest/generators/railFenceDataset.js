/**
 * Deterministischer Rail-Fence-Datensatz für Qualitätsgates.
 *
 * Ziel: reproduzierbare Pflichtfälle und ausreichend breite Rails-/Textverteilung,
 * damit Crack-Änderungen gegen stabile Klartextsignaturen bewertet werden können.
 */

class SeededRNG {
  constructor(seed = 0) {
    this.a = 1664525;
    this.c = 1013904223;
    this.m = 2 ** 32;
    this.seed = seed >>> 0;
  }

  next() {
    this.seed = (this.a * this.seed + this.c) % this.m;
    return this.seed / this.m;
  }

  nextInt(min, max) {
    const span = max - min + 1;
    return min + Math.floor(this.next() * span);
  }

  pick(items) {
    return items[this.nextInt(0, items.length - 1)];
  }
}

function buildRailPattern(length, rails) {
  const pattern = [];
  let rail = 0;
  let direction = 1;

  for (let index = 0; index < length; index += 1) {
    pattern.push(rail);
    if (rail === 0) {
      direction = 1;
    } else if (rail === rails - 1) {
      direction = -1;
    }
    rail += direction;
  }

  return pattern;
}

function encryptRailFence(text, rails) {
  const source = String(text || "");
  const pattern = buildRailPattern(source.length, rails);
  const buckets = Array.from({ length: rails }, () => []);

  for (let index = 0; index < source.length; index += 1) {
    buckets[pattern[index]].push(source[index]);
  }

  return buckets.map((bucket) => bucket.join("")).join("");
}

const MANDATORY_CASES = [
  { plaintext: "POTENTIALTOPFMODELL", key: 3 },
  { plaintext: "VERSCHRAENKTE TEILCHEN", key: 4 },
  { plaintext: "ABITUR AUFGABE TRAINING", key: 5 },
  { plaintext: "FOTONEN SIGNAL UND FELD", key: 6 },
  { plaintext: "QUANTEN FELDER UND WELLEN", key: 7 },
];

const PART_A = [
  "ABITUR",
  "AUFGABE",
  "TRAINING",
  "BERECHNE",
  "WELLE",
  "SIGNAL",
  "IMPULS",
  "ENERGIE",
  "QUANTEN",
  "TEILCHEN",
  "FELD",
  "MODELL",
  "ANALYSE",
  "RICHTUNG",
  "STRUKTUR",
  "NACHRICHT",
];

const PART_B = [
  "UND",
  "MIT",
  "FUER",
  "PLUS",
  "SOWIE",
];

const PART_C = [
  "KLAREM TEXT",
  "STABILER AUSGABE",
  "DEUTLICHER SPRACHE",
  "SICHERER SEGMENTIERUNG",
  "ROBUSTER WERTUNG",
  "PRAEZISER PRUEFUNG",
];

function buildPlaintext(rng, id) {
  const left = rng.pick(PART_A);
  const middle = rng.pick(PART_A);
  const joiner = rng.pick(PART_B);
  const tail = rng.pick(PART_C);
  const serial = ` FALL ${String(id + 1).padStart(4, "0")}`;

  return `${left} ${joiner} ${middle} ${tail}${serial}`;
}

function generateRailFenceDataset(n, seed = 0) {
  const rng = new SeededRNG(seed);
  const dataset = [];
  const seen = new Set();

  for (const mandatoryCase of MANDATORY_CASES) {
    const signature = `${mandatoryCase.key}|${mandatoryCase.plaintext}`;
    seen.add(signature);
    dataset.push({
      id: dataset.length,
      plaintext: mandatoryCase.plaintext,
      key: mandatoryCase.key,
      ciphertext: encryptRailFence(mandatoryCase.plaintext, mandatoryCase.key),
      mandatory: true,
    });
  }

  while (dataset.length < n) {
    const plaintext = buildPlaintext(rng, dataset.length);
    const key = rng.nextInt(2, 10);
    const signature = `${key}|${plaintext}`;
    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    dataset.push({
      id: dataset.length,
      plaintext,
      key,
      ciphertext: encryptRailFence(plaintext, key),
      mandatory: false,
    });
  }

  return dataset;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SeededRNG,
    generateRailFenceDataset,
  };
}
