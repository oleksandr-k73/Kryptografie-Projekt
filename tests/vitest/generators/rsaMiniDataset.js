/**
 * Deterministischer RSA-Mini-Datensatz fuer Qualitaetsgates.
 *
 * Ziel: reproduzierbare Keypairs + Zahlentokens, damit RSA-Regressionen
 * gegen einen stabilen 1k-Lauf geprueft werden koennen.
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

const PRIME_LIST = [11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53];
const E_CANDIDATES = [3, 5, 7, 11, 13, 17, 19, 23, 29];

function gcd(a, b) {
  let left = a < 0n ? -a : a;
  let right = b < 0n ? -b : b;
  while (right !== 0n) {
    const temp = left % right;
    left = right;
    right = temp;
  }
  return left;
}

function modInverse(value, modulus) {
  let a = value % modulus;
  let m = modulus;
  let t = 0n;
  let newT = 1n;
  let r = m;
  let newR = a;

  while (newR !== 0n) {
    const quotient = r / newR;
    [t, newT] = [newT, t - quotient * newT];
    [r, newR] = [newR, r - quotient * newR];
  }

  if (r !== 1n && r !== -1n) {
    // Ohne Inverses gaebe es kein RSA-Schluesselpaar.
    throw new Error("Kein modulares Inverses gefunden.");
  }

  if (t < 0n) {
    t += m;
  }

  return t;
}

function modPow(base, exponent, modulus) {
  let result = 1n;
  let factor = base % modulus;
  let exp = exponent;

  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * factor) % modulus;
    }
    factor = (factor * factor) % modulus;
    exp /= 2n;
  }

  return result;
}

function buildKeypair(rng) {
  let p = rng.pick(PRIME_LIST);
  let q = rng.pick(PRIME_LIST);
  while (q === p) {
    q = rng.pick(PRIME_LIST);
  }

  const pBig = BigInt(p);
  const qBig = BigInt(q);
  const n = pBig * qBig;
  const phi = (pBig - 1n) * (qBig - 1n);

  let e = rng.pick(E_CANDIDATES);
  while (gcd(BigInt(e), phi) !== 1n) {
    e = rng.pick(E_CANDIDATES);
  }

  const eBig = BigInt(e);
  const d = modInverse(eBig, phi);

  return {
    p: pBig,
    q: qBig,
    n,
    e: eBig,
    d,
  };
}

function buildPlaintextTokens(rng, n) {
  const count = rng.nextInt(1, 3);
  const max = Number(n) - 2;
  const tokens = [];

  for (let index = 0; index < count; index += 1) {
    // Tokens bleiben im sicheren Bereich 2..n-2, damit 0/1 als Sonderfaelle vermieden werden.
    tokens.push(BigInt(rng.nextInt(2, max)));
  }

  return tokens;
}

function tokensToString(tokens) {
  return tokens.map((value) => value.toString()).join(" ");
}

function encryptTokens(tokens, e, n) {
  return tokens.map((token) => modPow(token, e, n));
}

const MANDATORY_CASE = {
  plaintext: "53",
  ciphertext: "26",
  p: 11n,
  q: 17n,
  n: 187n,
  e: 7n,
  d: 23n,
};

function generateRsaMiniDataset(n, seed = 0) {
  const rng = new SeededRNG(seed);
  const dataset = [];
  const seen = new Set();

  const mandatorySignature = `${MANDATORY_CASE.n}|${MANDATORY_CASE.e}|${MANDATORY_CASE.plaintext}`;
  seen.add(mandatorySignature);
  dataset.push({
    id: dataset.length,
    plaintext: MANDATORY_CASE.plaintext,
    ciphertext: MANDATORY_CASE.ciphertext,
    p: MANDATORY_CASE.p.toString(),
    q: MANDATORY_CASE.q.toString(),
    n: MANDATORY_CASE.n.toString(),
    e: MANDATORY_CASE.e.toString(),
    d: MANDATORY_CASE.d.toString(),
    mandatory: true,
  });

  // Guard gegen Endlosschleifen bei zu kleiner Suchmenge.
  let attempts = 0;
  const maxAttempts = Math.max(3000, n * 200);

  while (dataset.length < n) {
    attempts += 1;
    if (attempts > maxAttempts) {
      throw new Error(
        `generateRsaMiniDataset: reached maxAttempts (${maxAttempts}) while building dataset of size ${n}. ` +
          `Produced ${dataset.length} unique entries so far; seen set size ${seen.size}.`
      );
    }

    const keypair = buildKeypair(rng);
    const plaintextTokens = buildPlaintextTokens(rng, keypair.n);
    const plaintext = tokensToString(plaintextTokens);
    const signature = `${keypair.n}|${keypair.e}|${plaintext}`;

    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    const ciphertext = tokensToString(encryptTokens(plaintextTokens, keypair.e, keypair.n));

    dataset.push({
      id: dataset.length,
      plaintext,
      ciphertext,
      p: keypair.p.toString(),
      q: keypair.q.toString(),
      n: keypair.n.toString(),
      e: keypair.e.toString(),
      d: keypair.d.toString(),
      mandatory: false,
    });
  }

  return dataset;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SeededRNG,
    generateRsaMiniDataset,
  };
}
