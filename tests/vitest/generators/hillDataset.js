/**
 * Deterministischer Hill-Datensatz für das Keyed-E2E-Gate.
 *
 * Ziel: viele unterschiedliche Matrixgrößen testen, ohne die Runtime über den Browser zu belasten.
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
  "KOHERENZ",
  "PHOTONEN",
  "MATRIX",
  "ALGORITHMUS",
];

const ARTICLES = ["DER", "DIE", "DAS", "EIN"];

const MANDATORY_CASES = [
  {
    plaintext: "LICHT IMPULS",
    matrix: [
      [3, 3],
      [2, 5],
    ],
  },
  {
    plaintext: "QUANTEN FELD ANALYSE",
    matrix: [
      [1, 2, 3],
      [0, 1, 4],
      [0, 0, 1],
    ],
  },
  {
    plaintext: "LASER TRIFFT GITTER",
    matrix: [
      [1, 2, 0, 1],
      [0, 1, 3, 0],
      [0, 0, 1, 4],
      [0, 0, 0, 1],
    ],
  },
];

function normalizeHillAZ(text) {
  // Normalisierung entspricht dem Hill-Workflow, damit Encrypt/Decrypt verlässlich vergleichbar bleibt.
  return String(text || "")
    .normalize("NFD")
    .replace(/A\u0308|Ä/gi, "AE")
    .replace(/O\u0308|Ö/gi, "OE")
    .replace(/U\u0308|Ü/gi, "UE")
    .replace(/[ßẞ]/g, "SS")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function padToMultiple(text, size) {
  const remainder = text.length % size;
  if (remainder === 0) {
    return text;
  }
  return text + "X".repeat(size - remainder);
}

function mod(value, modulo) {
  return ((value % modulo) + modulo) % modulo;
}

function modInverse(value, modulo) {
  let a = mod(value, modulo);
  let t = 0;
  let newT = 1;
  let r = modulo;
  let newR = a;

  while (newR !== 0) {
    const quotient = Math.floor(r / newR);
    [t, newT] = [newT, t - quotient * newT];
    [r, newR] = [newR, r - quotient * newR];
  }

  if (r !== 1) {
    return null;
  }

  return mod(t, modulo);
}

function matrixMultiplyVector(matrix, vector, modulo) {
  const size = matrix.length;
  const output = new Array(size).fill(0);

  for (let row = 0; row < size; row += 1) {
    let sum = 0;
    for (let col = 0; col < size; col += 1) {
      sum += matrix[row][col] * vector[col];
    }
    output[row] = mod(sum, modulo);
  }

  return output;
}

function buildMinor(matrix, removeRow, removeCol) {
  const minor = [];
  for (let row = 0; row < matrix.length; row += 1) {
    if (row === removeRow) {
      continue;
    }
    const newRow = [];
    for (let col = 0; col < matrix.length; col += 1) {
      if (col === removeCol) {
        continue;
      }
      newRow.push(matrix[row][col]);
    }
    minor.push(newRow);
  }
  return minor;
}

function determinant(matrix, modulo) {
  const size = matrix.length;
  if (size === 1) {
    return mod(matrix[0][0], modulo);
  }
  if (size === 2) {
    return mod(matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0], modulo);
  }

  let det = 0;
  for (let col = 0; col < size; col += 1) {
    const sign = col % 2 === 0 ? 1 : -1;
    const minor = buildMinor(matrix, 0, col);
    det = mod(det + sign * matrix[0][col] * determinant(minor, modulo), modulo);
  }
  return det;
}

function adjugate(matrix, modulo) {
  const size = matrix.length;
  const adj = Array.from({ length: size }, () => new Array(size).fill(0));

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const sign = (row + col) % 2 === 0 ? 1 : -1;
      const minor = buildMinor(matrix, row, col);
      const cofactor = mod(sign * determinant(minor, modulo), modulo);
      // Transponieren, damit die Adjunkte direkt entsteht.
      adj[col][row] = cofactor;
    }
  }

  return adj;
}

function invertMatrixMod(matrix, modulo) {
  const size = matrix.length;
  const normalized = matrix.map((row) => row.map((value) => mod(value, modulo)));
  const det = determinant(normalized, modulo);
  const detInv = modInverse(det, modulo);
  if (detInv == null) {
    return null;
  }

  if (size === 1) {
    return [[detInv]];
  }

  const adj = adjugate(normalized, modulo);
  return adj.map((row) => row.map((value) => mod(value * detInv, modulo)));
}

function isInvertible(matrix, modulo) {
  return Boolean(invertMatrixMod(matrix, modulo));
}

function encryptHill(text, matrix, modulo = 26) {
  const size = matrix.length;
  const normalized = padToMultiple(normalizeHillAZ(text), size);
  const blocks = [];

  for (let index = 0; index < normalized.length; index += size) {
    blocks.push(normalized.slice(index, index + size));
  }

  let output = "";
  for (const block of blocks) {
    const vector = Array.from(block).map((char) => char.charCodeAt(0) - 65);
    const encoded = matrixMultiplyVector(matrix, vector, modulo);
    output += encoded.map((value) => String.fromCharCode(65 + value)).join("");
  }

  return output;
}

function buildPlaintext(rng) {
  const left = rng.pick(CONTENT_WORDS);
  const article = rng.pick(ARTICLES);
  const middle = rng.pick(CONTENT_WORDS);
  const tail = rng.next() < 0.45 ? rng.pick(CONTENT_WORDS) : null;
  const extra = rng.next() < 0.3 ? rng.pick(CONTENT_WORDS) : null;

  // UND + Artikel stabilisieren das Sprachprofil, damit der Datensatz nicht zu „zufällig“ wirkt.
  return [left, article, middle, "UND", tail, extra].filter(Boolean).join(" ");
}

function generateRandomMatrix(rng, size, modulo) {
  const matrix = [];
  for (let row = 0; row < size; row += 1) {
    const rowValues = [];
    for (let col = 0; col < size; col += 1) {
      rowValues.push(rng.nextInt(0, modulo - 1));
    }
    matrix.push(rowValues);
  }
  return matrix;
}

function matrixSignature(matrix) {
  return JSON.stringify(matrix);
}

function generateHillDataset(n, seed = 0) {
  const rng = new SeededRNG(seed);
  const dataset = [];
  const seen = new Set();

  for (const mandatoryCase of MANDATORY_CASES) {
    if (!isInvertible(mandatoryCase.matrix, 26)) {
      throw new Error("Mandatory Hill-Matrix ist nicht invertierbar.");
    }
    const keyString = matrixSignature(mandatoryCase.matrix);
    const signature = `${keyString}|${mandatoryCase.plaintext}`;
    seen.add(signature);
    dataset.push({
      id: dataset.length,
      plaintext: mandatoryCase.plaintext,
      matrix: mandatoryCase.matrix,
      keyString,
      ciphertext: encryptHill(mandatoryCase.plaintext, mandatoryCase.matrix, 26),
      mandatory: true,
    });
  }

  // Guard gegen Endlosschleifen bei zu kleiner Suchmenge.
  let attempts = 0;
  const maxAttempts = Math.max(2500, n * 180);

  while (dataset.length < n) {
    attempts += 1;
    if (attempts > maxAttempts) {
      throw new Error(
        `generateHillDataset: reached maxAttempts (${maxAttempts}) while building dataset of size ${n}. ` +
          `Produced ${dataset.length} unique entries so far; seen set size ${seen.size}.`
      );
    }

    const size = rng.pick([2, 3, 4]);
    const matrix = generateRandomMatrix(rng, size, 26);
    if (!isInvertible(matrix, 26)) {
      continue;
    }

    const plaintext = buildPlaintext(rng);
    const keyString = matrixSignature(matrix);
    const signature = `${size}|${keyString}|${plaintext}`;

    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    dataset.push({
      id: dataset.length,
      plaintext,
      matrix,
      keyString,
      ciphertext: encryptHill(plaintext, matrix, 26),
      mandatory: false,
    });
  }

  return dataset;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SeededRNG,
    generateHillDataset,
  };
}
