/**
 * Deterministischer Affine-Datensatz für Qualitätsgates.
 *
 * Ziel: stabiler Mix aus Pflichtfällen und variierenden (a,b)-Schlüsseln,
 * damit Crack-Änderungen gegen reproduzierbare Klartexte geprüft werden können.
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

const DEFAULT_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const VALID_A_VALUES = [1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25];

function mod(value, modulo) {
  return ((value % modulo) + modulo) % modulo;
}

function encryptAffine(text, a, b, alphabet = DEFAULT_ALPHABET) {
  const modulus = alphabet.length;
  const indices = new Map();

  for (let index = 0; index < alphabet.length; index += 1) {
    indices.set(alphabet[index], index);
  }

  return Array.from(String(text || ""), (ch) => {
    const idx = indices.get(ch);
    if (idx == null) {
      return ch;
    }
    const encodedIndex = mod(a * idx + b, modulus);
    return alphabet[encodedIndex];
  }).join("");
}

const MANDATORY_CASES = [
  { plaintext: "WAHRSCHEINLICHKEITSDICHTE", key: { a: 5, b: 8 } },
  { plaintext: "QUANTEN FELDER UND WELLEN", key: { a: 7, b: 3 } },
  { plaintext: "POTENTIALTOPF MODELL", key: { a: 11, b: 19 } },
  { plaintext: "LASER TRIFFT GITTER", key: { a: 3, b: 14 } },
  { plaintext: "ABITUR AUFGABE TRAINING", key: { a: 9, b: 4 } },
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
  "KLASSISCH",
  "QUANTEN",
  "SIGNATURE",
];

const ARTICLES = ["DER", "DIE", "DAS", "EIN"];

function buildPlaintext(rng) {
  const left = rng.pick(CONTENT_WORDS);
  const article = rng.pick(ARTICLES);
  const middle = rng.pick(CONTENT_WORDS);
  const tail = rng.next() < 0.5 ? rng.pick(CONTENT_WORDS) : null;
  const predicate = rng.next() < 0.35 ? "IST" : null;

  // UND + Artikel/IST sind Score-Treiber im Caesar-Scoring und stabilisieren die Crack-Rankings.
  return [left, article, middle, "UND", tail, predicate].filter(Boolean).join(" ");
}

function generateAffineDataset(n, seed = 0) {
  const rng = new SeededRNG(seed);
  const dataset = [];
  const seen = new Set();

  for (const mandatoryCase of MANDATORY_CASES) {
    const key = `${mandatoryCase.key.a},${mandatoryCase.key.b}`;
    const signature = `${key}|${mandatoryCase.plaintext}`;
    seen.add(signature);
    dataset.push({
      id: dataset.length,
      plaintext: mandatoryCase.plaintext,
      key,
      a: mandatoryCase.key.a,
      b: mandatoryCase.key.b,
      ciphertext: encryptAffine(
        mandatoryCase.plaintext,
        mandatoryCase.key.a,
        mandatoryCase.key.b
      ),
      mandatory: true,
    });
  }

  // Guard gegen Endlosschleifen bei zu kleiner Suchmenge.
  let attempts = 0;
  const maxAttempts = Math.max(1500, n * 150);

  while (dataset.length < n) {
    attempts += 1;
    if (attempts > maxAttempts) {
      throw new Error(
        `generateAffineDataset: reached maxAttempts (${maxAttempts}) while building dataset of size ${n}. ` +
          `Produced ${dataset.length} unique entries so far; seen set size ${seen.size}.`
      );
    }

    const plaintext = buildPlaintext(rng);
    const a = rng.pick(VALID_A_VALUES);
    const b = rng.nextInt(0, DEFAULT_ALPHABET.length - 1);
    const key = `${a},${b}`;
    const signature = `${key}|${plaintext}`;

    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    dataset.push({
      id: dataset.length,
      plaintext,
      key,
      a,
      b,
      ciphertext: encryptAffine(plaintext, a, b),
      mandatory: false,
    });
  }

  return dataset;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SeededRNG,
    generateAffineDataset,
  };
}
