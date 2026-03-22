/**
 * Deterministischer Binär-Datensatz fuer Qualitaetsgates.
 *
 * Ziel: feste Pflichtfaelle plus reproduzierbare Zufallsfaelle,
 * damit Binärcode-Decode/Crack Aenderungen stabil bewertet werden koennen.
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

const BINARY_TABLE = Array.from({ length: 256 }, (_value, index) =>
  index.toString(2).padStart(8, "0")
);

function encodeUtf8(text) {
  const source = String(text || "");
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(source);
  }

  if (typeof Buffer !== "undefined") {
    // Node-Fallback: Tests laufen ohne Browser-Kontext.
    return Uint8Array.from(Buffer.from(source, "utf8"));
  }

  // Letzter Fallback haelt UTF-8-Bytes stabil, falls keine APIs vorhanden sind.
  const encoded = unescape(encodeURIComponent(source));
  const bytes = new Uint8Array(encoded.length);
  for (let index = 0; index < encoded.length; index += 1) {
    bytes[index] = encoded.charCodeAt(index);
  }
  return bytes;
}

function encodeBinary(bytes) {
  const source = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes || []);
  let output = "";

  for (let index = 0; index < source.length; index += 1) {
    if (index > 0) {
      output += " ";
    }
    output += BINARY_TABLE[source[index]];
  }

  return output;
}

function encodeBinaryText(text) {
  // Eigene Binär-Implementierung haelt den Datensatz konsistent zum Cipher.
  return encodeBinary(encodeUtf8(text));
}

const MANDATORY_CASES = [
  { plaintext: "UNSCHAERFE IM ORT" },
  { plaintext: "UEBER DEM FLUSS" },
  { plaintext: "QUANTEN SPRUNG 0001" },
  { plaintext: "SIGNAL UND RICHTUNG 0002" },
  { plaintext: "ENERGIE IM FELD 0003" },
];

const PART_A = [
  "QUANTEN",
  "SIGNAL",
  "ENERGIE",
  "IMPULS",
  "FELDER",
  "WELLEN",
  "SYSTEM",
  "MODELL",
  "ANALYSE",
  "RICHTUNG",
  "KODIERUNG",
  "UNSCHAERFE",
];

const PART_B = ["UND", "MIT", "FUER", "PLUS", "SOWIE"];

const PART_C = [
  "STABILER AUSGABE",
  "ROBUSTER PRUEFUNG",
  "KLAREM TEXT",
  "SICHERER BEWERTUNG",
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

function generateBinaryDataset(n, seed = 0) {
  const rng = new SeededRNG(seed);
  const dataset = [];
  const seen = new Set();

  for (const mandatoryCase of MANDATORY_CASES) {
    const signature = mandatoryCase.plaintext;
    seen.add(signature);
    dataset.push({
      id: dataset.length,
      plaintext: mandatoryCase.plaintext,
      ciphertext: encodeBinaryText(mandatoryCase.plaintext),
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
        `generateBinaryDataset: reached maxAttempts (${maxAttempts}) while building dataset of size ${n}. ` +
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
      ciphertext: encodeBinaryText(plaintext),
      mandatory: false,
    });
  }

  return dataset;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SeededRNG,
    generateBinaryDataset,
  };
}
