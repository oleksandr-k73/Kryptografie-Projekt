/**
 * Deterministischer Zahlen-Caesar-Datensatz fuer Keyless-Gates.
 *
 * Ziel: reproduzierbare Klartexte und Keys, damit Crack-Qualitaet
 * konsistent bewertet werden kann und Regressionen sichtbar bleiben.
 */

class SeededRNG {
  constructor(seed = 0) {
    this.a = 1664525;
    this.c = 1013904223;
    this.m = 2 ** 32;
    this.seed = seed >>> 0;
  }

  next() {
    // Linearer Kongruenzgenerator fuer stabile, platformuebergreifende Seeds.
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

function normalizeAZ(input) {
  let normalized = String(input || "").normalize("NFD");
  // Die Normalisierung folgt dem Cipher, damit Testdaten exakt gleich kodiert werden.
  normalized = normalized
    .replace(/A\u0308|Ä/gi, "AE")
    .replace(/O\u0308|Ö/gi, "OE")
    .replace(/U\u0308|Ü/gi, "UE")
    .replace(/[ßẞ]/g, "SS");
  return normalized.replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, "");
}

function normalizeKey(key) {
  // Modulo-Normalisierung haelt die Daten auch fuer negative Keys stabil.
  return ((Number(key) % 26) + 26) % 26;
}

function shiftAZ(text, shift) {
  const normalized = normalizeKey(shift);
  let output = "";

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index) - 65;
    const shifted = (code + normalized) % 26;
    output += String.fromCharCode(65 + shifted);
  }

  return output;
}

function toA1Z26(text) {
  // Zahlen-Output bleibt streng numerisch, wie im Cipher.
  return Array.from(text, (ch) => String(ch.charCodeAt(0) - 64)).join("-");
}

function encryptNumberCaesar(plaintext, key) {
  const normalized = normalizeAZ(plaintext);
  const shifted = shiftAZ(normalized, key);
  return toA1Z26(shifted);
}

const MANDATORY_CASES = [
  { plaintext: "MODELL UND GRENZEN", key: 3 },
  { plaintext: "QUANTEN FELD UND WELLEN", key: 7 },
  { plaintext: "LASER IMPULS UND SIGNAL", key: 11 },
];

const PART_A = [
  "ABITUR",
  "AUFGABE",
  "ANALYSE",
  "ENERGIE",
  "FELD",
  "GRENZEN",
  "IMPULS",
  "LASER",
  "MODELL",
  "QUANTEN",
  "SIGNAL",
  "STRAHLUNG",
  "TEILCHEN",
  "WELLEN",
  "SYSTEM",
  "MESSUNG",
  "MATRIX",
  "KODIERUNG",
];

const PART_B = [
  "UND",
  "MIT",
  "FUER",
  "PLUS",
  "SOWIE",
  "ODER",
];

const PART_C = [
  "KLAREM TEXT",
  "STABILER AUSGABE",
  "ROBUSTER WERTUNG",
  "SAUBERER PRUEFUNG",
  "KLASSISCHER CHIFFRE",
  "GENAUER ANALYSE",
  "SICHERER STRUKTUR",
  "DEUTLICHER SPRACHE",
  "GUTER SEGMENTIERUNG",
];

function buildSerial(id) {
  // Serienkuerzel in Buchstaben haelt die Normalisierung stabil und eindeutig.
  let value = id + 1;
  let output = "";
  while (value > 0) {
    value -= 1;
    output = String.fromCharCode(65 + (value % 26)) + output;
    value = Math.floor(value / 26);
  }
  return output.padStart(3, "A");
}

function buildPlaintext(rng, id) {
  const left = rng.pick(PART_A);
  const middle = rng.pick(PART_A);
  const joiner = rng.pick(PART_B);
  const tail = rng.pick(PART_C);
  const serial = buildSerial(id);

  return `${left} ${joiner} ${middle} ${tail} SERIE ${serial}`;
}

function generateNumberCaesarDataset(n, seed = 0) {
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
      ciphertext: encryptNumberCaesar(mandatoryCase.plaintext, mandatoryCase.key),
      mandatory: true,
    });
  }

  while (dataset.length < n) {
    const plaintext = buildPlaintext(rng, dataset.length);
    const key = rng.nextInt(0, 25);
    const signature = `${key}|${plaintext}`;

    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    dataset.push({
      id: dataset.length,
      plaintext,
      key,
      ciphertext: encryptNumberCaesar(plaintext, key),
      mandatory: false,
    });
  }

  return dataset;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SeededRNG,
    generateNumberCaesarDataset,
  };
}
