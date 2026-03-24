/**
 * Deterministischer ASCII-Dezimal-Datensatz fuer Qualitaetsgates.
 *
 * Ziel: feste Pflichtfaelle plus reproduzierbare Zufallsfaelle,
 * damit ASCII-Decode/Crack Aenderungen stabil bewertet werden koennen.
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

function encodeAsciiDecimalText(text) {
  const source = String(text || "");
  const codes = [];

  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    if (code > 255) {
      // Guard haelt den Datensatz im vereinbarten ASCII-Bereich.
      throw new Error("ASCII dataset contains non-ASCII characters.");
    }
    codes.push(String(code));
  }

  return codes.join(" ");
}

const MANDATORY_CASES = [
  { plaintext: "LASER TRIFFT GITTER" },
  { plaintext: "SIGNAL IM GITTER" },
  { plaintext: "ROBUSTE ASCII CODES" },
  { plaintext: "DATEN FLUSS 0001" },
  { plaintext: "PRUEFUNG IM FELD 0002" },
];

const PART_A = [
  "LASER",
  "SIGNAL",
  "IMPULS",
  "GITTER",
  "FELD",
  "STRUKTUR",
  "KONTROLLE",
  "AUSGABE",
  "PRUEFUNG",
  "ANALYSE",
  "ASCII",
  "CODIERUNG",
];

const PART_B = ["UND", "MIT", "FUER", "IM", "PLUS"];

const PART_C = [
  "STABILEM FLUSS",
  "KLARER AUSGABE",
  "ROBUSTER PRUEFUNG",
  "SICHEREM SIGNAL",
  "PRAEZISER KONTROLLE",
];

function buildPlaintext(rng, id) {
  const left = rng.pick(PART_A);
  const middle = rng.pick(PART_A);
  const joiner = rng.pick(PART_B);
  const tail = rng.pick(PART_C);
  const serial = ` FALL ${String(id + 1).padStart(4, "0")}`;

  // Seriennummer stellt Einzigartigkeit sicher, damit der 1k-Gate stabil bleibt.
  return `${left} ${joiner} ${middle} ${tail}${serial}`;
}

function generateAsciiDataset(n, seed = 0) {
  const rng = new SeededRNG(seed);
  const dataset = [];
  const seen = new Set();

  for (const mandatoryCase of MANDATORY_CASES) {
    const signature = mandatoryCase.plaintext;
    seen.add(signature);
    dataset.push({
      id: dataset.length,
      plaintext: mandatoryCase.plaintext,
      ciphertext: encodeAsciiDecimalText(mandatoryCase.plaintext),
      mandatory: true,
    });
  }

  // Guard gegen Endlosschleifen, falls die Kombinatorik zu klein wird.
  let attempts = 0;
  const maxAttempts = Math.max(1500, n * 150);

  while (dataset.length < n) {
    attempts += 1;
    if (attempts > maxAttempts) {
      throw new Error(
        `generateAsciiDataset: reached maxAttempts (${maxAttempts}) while building dataset of size ${n}. ` +
          `Produced ${dataset.length} unique entries so far; seen set size ${seen.size}.`
      );
    }

    const plaintext = buildPlaintext(rng, dataset.length);
    if (seen.has(plaintext)) {
      continue;
    }

    seen.add(plaintext);
    dataset.push({
      id: dataset.length,
      plaintext,
      ciphertext: encodeAsciiDecimalText(plaintext),
      mandatory: false,
    });
  }

  return dataset;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SeededRNG,
    generateAsciiDataset,
  };
}
