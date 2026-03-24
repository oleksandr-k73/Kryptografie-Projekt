/**
 * Deterministischer Positionscipher-Datensatz für Qualitätsgates.
 *
 * Ziel: reproduzierbare Pflichtfälle und ausreichend Permutationsstreuung,
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

function normalizeBase(input) {
  return String(input || "")
    .replace(/Ä/g, "AE")
    .replace(/Ö/g, "OE")
    .replace(/Ü/g, "UE")
    .replace(/ä/g, "AE")
    .replace(/ö/g, "OE")
    .replace(/ü/g, "UE")
    .replace(/ß/g, "SS")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function toPositionAZ(text) {
  return normalizeBase(text).replace(/[^A-Z]/g, "");
}

function padToMultiple(text, blockLength) {
  const remainder = text.length % blockLength;
  if (remainder === 0) {
    return text;
  }
  return text + "X".repeat(blockLength - remainder);
}

function formatKey(order) {
  return order.join("-");
}

function encryptPosition(text, keyOrder) {
  const blockLength = keyOrder.length;
  const normalized = padToMultiple(toPositionAZ(text), blockLength);
  let output = "";

  for (let offset = 0; offset < normalized.length; offset += blockLength) {
    const block = normalized.slice(offset, offset + blockLength);
    // Blockweise Permutation hält die Testfälle nah an der realen Cipher-Implementierung.
    for (const order of keyOrder) {
      output += block[order - 1] || "X";
    }
  }

  return output;
}

function buildPermutation(rng, length) {
  const values = Array.from({ length }, (_, index) => index + 1);
  for (let index = length - 1; index > 0; index -= 1) {
    const swapIndex = rng.nextInt(0, index);
    const temp = values[index];
    values[index] = values[swapIndex];
    values[swapIndex] = temp;
  }
  return values;
}

const MANDATORY_CASES = [
  { plaintext: "QUANTEN SPRUNG", keyOrder: [2, 5, 3, 1, 4] },
  { plaintext: "LASER TRIFFT GITTER", keyOrder: [2, 1, 3] },
  { plaintext: "PHOTOEFFEKT DATEN", keyOrder: [1, 3, 2, 4, 5] },
  { plaintext: "MESSREIHE MIT FEHLER", keyOrder: [2, 1, 3, 5, 4, 6] },
  { plaintext: "UNSCHAERFE IM ORT", keyOrder: [2, 1] },
];

const CONTENT_WORDS = [
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
  "LASER",
  "TRIFFT",
  "GITTER",
  "PHOTOEFFEKT",
  "MESSREIHE",
  "UNSCHAERFE",
  "FEHLER",
  "DATEN",
  "TOPF",
  "POTENTIAL",
  "ORT",
  "SPRUNG",
];

const JOINERS = ["UND", "MIT", "IM", "FUER"];

function buildPlaintext(rng) {
  const left = rng.pick(CONTENT_WORDS);
  const joiner = rng.pick(JOINERS);
  const middle = rng.pick(CONTENT_WORDS);
  const tail = rng.next() < 0.35 ? rng.pick(CONTENT_WORDS) : null;

  return [left, joiner, middle, tail].filter(Boolean).join(" ");
}

function generatePositionDataset(n, seed = 0) {
  const rng = new SeededRNG(seed);
  const dataset = [];
  const seen = new Set();

  for (const mandatoryCase of MANDATORY_CASES) {
    const key = formatKey(mandatoryCase.keyOrder);
    const signature = `${key}|${mandatoryCase.plaintext}`;
    seen.add(signature);
    dataset.push({
      id: dataset.length,
      plaintext: mandatoryCase.plaintext,
      key,
      keyLength: mandatoryCase.keyOrder.length,
      ciphertext: encryptPosition(mandatoryCase.plaintext, mandatoryCase.keyOrder),
      mandatory: true,
    });
  }

  // Guard against infinite loops when unique (key, plaintext) pairs run out.
  // maxAttempts is proportional to `n` with a sane floor to allow sufficient
  // sampling before giving up. If reached, throw a clear error describing
  // the state to aid debugging.
  let attempts = 0;
  const maxAttempts = Math.max(1200, n * 120);

  while (dataset.length < n) {
    attempts += 1;
    if (attempts > maxAttempts) {
      throw new Error(
        `generatePositionDataset: reached maxAttempts (${maxAttempts}) while building dataset of size ${n}. ` +
          `Produced ${dataset.length} unique entries so far; seen set size ${seen.size}. ` +
          `Consider increasing the search space or lowering requested n.`
      );
    }

    const plaintext = buildPlaintext(rng);
    const keyLength = rng.nextInt(2, 6);
    const keyOrder = buildPermutation(rng, keyLength);
    const key = formatKey(keyOrder);
    const signature = `${key}|${plaintext}`;
    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    dataset.push({
      id: dataset.length,
      plaintext,
      key,
      keyLength,
      ciphertext: encryptPosition(plaintext, keyOrder),
      mandatory: false,
    });
  }

  return dataset;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SeededRNG,
    generatePositionDataset,
  };
}
