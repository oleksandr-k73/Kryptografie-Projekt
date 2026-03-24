/**
 * Deterministischer SHA-256-Datensatz für Qualitätsgates.
 *
 * Ziel: feste Pflichtfälle plus reproduzierbare Zufallsfälle mit Node crypto als Referenz,
 * damit SHA-256-Hash/Crack Änderungen stabil bewertet werden können.
 */

const crypto = require("node:crypto");

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
  if (typeof Buffer !== "undefined") {
    return Buffer.from(source, "utf8");
  }

  const encoded = unescape(encodeURIComponent(source));
  const bytes = new Uint8Array(encoded.length);
  for (let index = 0; index < encoded.length; index += 1) {
    bytes[index] = encoded.charCodeAt(index);
  }
  return bytes;
}

function hashSha256(text) {
  // Node crypto ist die Referenz-Implementierung für die Tests.
  // Damit werden die Hashes konsistent gegen die Browser-Implementierung geprüft.
  const hash = crypto.createHash("sha256");
  hash.update(encodeUtf8(text));
  return hash.digest("hex").toUpperCase();
}

const MANDATORY_CASES = [
  { plaintext: "MELDE DICH BEI DER LEHRKRAFT WENN DU DEN TOKEN GEFUNDEN HAST" },
  { plaintext: "UNSCHAERFE IM IMPULS" },
  { plaintext: "INTERFERENZ AM SPALT" },
  { plaintext: "HASHWERT PRUEFUNG EINS" },
  { plaintext: "ROBUSTE SHA256 SICHERHEIT" },
];

const PART_A = [
  "SHA256",
  "HASH",
  "DIGEST",
  "FINGER",
  "DRUCK",
  "ABSATZ",
  "SICHERHEIT",
  "VERFAHREN",
  "PROTOKOLL",
  "SCHEMA",
  "MUSTER",
  "KENNWORT",
];

const PART_B = ["UND", "MIT", "FUER", "IM", "PLUS"];

const PART_C = [
  "STAERKE GEWAEHRLEISTET",
  "INTEGRITAET BESTAETIGT",
  "KONSISTENZ BEWAEHRT",
  "AUTHENTIZITAET GARANTIERT",
  "ZUVERLAESSIGKEIT PLAEDIERT",
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

function generateSha256Dataset(n, seed = 0) {
  const rng = new SeededRNG(seed);
  const dataset = [];
  const seen = new Set();

  for (const mandatoryCase of MANDATORY_CASES) {
    const signature = mandatoryCase.plaintext;
    seen.add(signature);
    dataset.push({
      id: dataset.length,
      plaintext: mandatoryCase.plaintext,
      hash: hashSha256(mandatoryCase.plaintext),
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
        `generateSha256Dataset: reached maxAttempts (${maxAttempts}) while building dataset of size ${n}. ` +
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
      hash: hashSha256(plaintext),
      mandatory: false,
    });
  }

  // Größe wird explizit validiert, damit keine Stille, unterschiedliche Datensätze entstehen.
  if (dataset.length !== n) {
    throw new Error(
      `generateSha256Dataset: wanted ${n} entries, got ${dataset.length}. ` +
        `This usually means combinatorial budget is too tight.`
    );
  }

  return dataset;
}

module.exports = {
  generateSha256Dataset,
};
