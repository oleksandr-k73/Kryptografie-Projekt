/**
 * Deterministischer HEX-Datensatz fuer Qualitaetsgates.
 *
 * Ziel: feste Pflichtfaelle plus reproduzierbare Zufallsfaelle,
 * damit HEX-Decode/Crack Aenderungen stabil bewertet werden koennen.
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

const HEX_TABLE = Array.from({ length: 256 }, (_value, index) =>
  index.toString(16).padStart(2, "0").toUpperCase()
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

function bytesToHex(bytes) {
  let output = "";
  for (const byte of bytes) {
    output += HEX_TABLE[byte];
  }
  return output;
}

function encodeHexText(text) {
  // Eigene HEX-Implementierung haelt den Datensatz konsistent zum Cipher.
  return bytesToHex(encodeUtf8(text));
}

const MANDATORY_CASES = [
  { plaintext: "UNSCHAERFE IM IMPULS" },
  { plaintext: "INTERFERENZ AM SPALT" },
  { plaintext: "HEXDATEN IM FLUSS" },
  { plaintext: "ROBUSTE HEX PRUEFUNG 0001" },
  { plaintext: "SIGNAL UND BYTESTROM 0002" },
];

const PART_A = [
  "HEX",
  "BYTE",
  "IMPULS",
  "SIGNAL",
  "FELDER",
  "WELLEN",
  "ANALYSE",
  "AUSGABE",
  "PRUEFUNG",
  "DATEN",
  "STROM",
  "CODIERUNG",
];

const PART_B = ["UND", "MIT", "FUER", "IM", "PLUS"];

const PART_C = [
  "STABILER AUSGABE",
  "ROBUSTER PRUEFUNG",
  "KLAREM TEXT",
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

function generateHexDataset(n, seed = 0) {
  const rng = new SeededRNG(seed);
  const dataset = [];
  const seen = new Set();

  for (const mandatoryCase of MANDATORY_CASES) {
    const signature = mandatoryCase.plaintext;
    seen.add(signature);
    dataset.push({
      id: dataset.length,
      plaintext: mandatoryCase.plaintext,
      ciphertext: encodeHexText(mandatoryCase.plaintext),
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
        `generateHexDataset: reached maxAttempts (${maxAttempts}) while building dataset of size ${n}. ` +
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
      ciphertext: encodeHexText(plaintext),
      mandatory: false,
    });
  }

  return dataset;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SeededRNG,
    generateHexDataset,
  };
}
