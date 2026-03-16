/**
 * Deterministischer Skytale-Datensatz für Qualitätsgates.
 *
 * Ziel: reproduzierbare Pflichtfälle und ausreichende Umfang-Streuung,
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

function toSkytaleAZ(text) {
  return normalizeBase(text).replace(/[^A-Z]/g, "");
}

function padToMultiple(text, key) {
  const remainder = text.length % key;
  if (remainder === 0) {
    return text;
  }
  return text + "X".repeat(key - remainder);
}

function encryptSkytale(text, key) {
  const normalized = padToMultiple(toSkytaleAZ(text), key);
  const rows = normalized.length / key;
  const columns = Array.from({ length: key }, () => []);
  let index = 0;

  for (let col = 0; col < key; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      columns[col][row] = normalized[index] || "X";
      index += 1;
    }
  }

  let output = "";
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < key; col += 1) {
      output += columns[col][row] || "X";
    }
  }

  return output;
}

const MANDATORY_CASES = [
  { plaintext: "LASER TRIFFT GITTER", key: 4 },
  { plaintext: "PHOTOEFFEKT DATEN", key: 5 },
  { plaintext: "MESSREIHE MIT FEHLER", key: 6 },
  { plaintext: "UNSCHAERFE IM ORT", key: 7 },
  { plaintext: "DCODE PLAYFAIR BITTE FUNKTIONIERE ICH MUSS WEITER", key: 4 },
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
  "DCODE",
  "PLAYFAIR",
  "FUNKTIONIERE",
  "BITTE",
  "WEITER",
  "ICH",
  "MUSS",
  "ORT",
];

const JOINERS = ["UND", "MIT", "IM"];

function buildPlaintext(rng) {
  const left = rng.pick(CONTENT_WORDS);
  const joiner = rng.pick(JOINERS);
  const right = rng.pick(CONTENT_WORDS);
  const tail = rng.next() < 0.35 ? rng.pick(CONTENT_WORDS) : null;

  return [left, joiner, right, tail].filter(Boolean).join(" ");
}

function generateScytaleDataset(n, seed = 0) {
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
      ciphertext: encryptSkytale(mandatoryCase.plaintext, mandatoryCase.key),
      mandatory: true,
    });
  }

  // Guard against infinite loops when unique (key, plaintext) pairs run out.
  // maxAttempts is proportional to `n` with a sane floor to allow sufficient
  // sampling before giving up. If reached, throw a clear error describing
  // the state to aid debugging.
  let attempts = 0;
  const maxAttempts = Math.max(1000, n * 100);

  while (dataset.length < n) {
    attempts += 1;
    if (attempts > maxAttempts) {
      throw new Error(
        `generateScytaleDataset: reached maxAttempts (${maxAttempts}) while building dataset of size ${n}. ` +
          `Produced ${dataset.length} unique entries so far; seen set size ${seen.size}. ` +
          `Consider increasing the search space or lowering requested n.`
      );
    }

    const plaintext = buildPlaintext(rng);
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
      ciphertext: encryptSkytale(plaintext, key),
      mandatory: false,
    });
  }

  return dataset;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SeededRNG,
    generateScytaleDataset,
  };
}
