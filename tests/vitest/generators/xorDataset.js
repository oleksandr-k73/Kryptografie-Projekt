/**
 * Deterministischer XOR-Datensatz fuer Qualitaetsgates.
 *
 * Ziel: feste Pflichtfaelle plus reproduzierbare Zufallsfaelle, damit Crack-Aenderungen
 * stabil bewertet werden koennen.
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
    output += byte.toString(16).padStart(2, "0").toUpperCase();
  }
  return output;
}

function xorToHex(plaintext, key) {
  const keyText = String(key || "");
  const keyBytes = new Uint8Array(keyText.length);
  for (let index = 0; index < keyText.length; index += 1) {
    keyBytes[index] = keyText.charCodeAt(index);
  }

  const plainBytes = encodeUtf8(plaintext);
  const output = new Uint8Array(plainBytes.length);
  for (let index = 0; index < plainBytes.length; index += 1) {
    output[index] = plainBytes[index] ^ keyBytes[index % keyBytes.length];
  }

  return bytesToHex(output);
}

const MANDATORY_CASES = [
  { plaintext: "QUANTEN SPRUNG", key: "KRYPTO" },
  { plaintext: "SIGNAL UND RICHTUNG", key: "LASER" },
  { plaintext: "ENERGIE UND IMPULS", key: "ATOMIC" },
  { plaintext: "MODELLE UND FELDER", key: "PHOTON" },
  { plaintext: "KODIERUNG IM TEST", key: "CODE" },
];

const PART_A = [
  "QUANTEN",
  "SIGNAL",
  "ENERGIE",
  "IMPULS",
  "FELDER",
  "TEILCHEN",
  "WELLEN",
  "SYSTEM",
  "MODELL",
  "ANALYSE",
  "RICHTUNG",
  "KODIERUNG",
];

const PART_B = [
  "UND",
  "MIT",
  "FUER",
  "PLUS",
  "SOWIE",
];

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

  return `${left} ${joiner} ${middle} ${tail}${serial}`;
}

function buildKey(rng) {
  const length = rng.nextInt(3, 8);
  let key = "";
  for (let index = 0; index < length; index += 1) {
    const charCode = 65 + rng.nextInt(0, 25);
    key += String.fromCharCode(charCode);
  }
  return key;
}

function generateXorDataset(n, seed = 0) {
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
      ciphertext: xorToHex(mandatoryCase.plaintext, mandatoryCase.key),
      mandatory: true,
    });
  }

  while (dataset.length < n) {
    const plaintext = buildPlaintext(rng, dataset.length);
    const key = buildKey(rng);
    const signature = `${key}|${plaintext}`;
    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    dataset.push({
      id: dataset.length,
      plaintext,
      key,
      ciphertext: xorToHex(plaintext, key),
      mandatory: false,
    });
  }

  return dataset;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SeededRNG,
    generateXorDataset,
  };
}
