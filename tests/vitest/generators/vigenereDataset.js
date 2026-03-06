/**
 * Deterministischer Datensatz-Generator für Vigenère-Benchmarks.
 *
 * Ziel: reproduzierbare Stage-Läufe mit klaren Quoten für Text-Buckets und
 * Key-Relationen, damit Performance-/Qualitätsvergleiche stabil bleiben.
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

const BUCKET_QUOTAS = {
  short: 0.3,
  medium: 0.4,
  long: 0.3,
};

const RELATION_QUOTAS = {
  "key < text": 0.5,
  "key > text/2": 0.3,
  "key == text": 0.2,
};

const PLAINTEXT_BY_BUCKET = {
  short: [
    "you shall nt pass",
    "the key and text",
    "you and the code",
    "the text is clear",
    "the words are clear",
    "you and the gate",
  ],
  medium: [
    "you and the words and the text we need",
    "the key and the text should decode clearly",
    "the code and the words are in the text",
    "you and the words and the code and the key",
    "the text and the key and the code are clear",
    "you and the text and the words are stable",
  ],
  long: [
    "you and the words and the text and the key and the code are clear in this benchmark message",
    "the key and the text and the words and the code repeat so language scoring can recover the plain text",
    "you and the text and the key and the code and the words should remain stable for every run",
    "the benchmark message keeps the words the key and the text so deterministic cracking is easy to verify",
    "you and the code and the key and the words and the text are repeated for robust seeded stages",
  ],
};

const BASE_KEYS = [
  "KEY",
  "BRICK",
  "LEMON",
  "CODE",
  "GATE",
  "STONE",
];

function normalizeLetterCount(text) {
  return String(text || "").replace(/[^A-Za-z]/g, "").length;
}

function vigenereEncrypt(plaintext, key) {
  const keyNorm = key.toUpperCase();
  const textNorm = plaintext.toUpperCase();
  let keyIndex = 0;
  let result = "";

  for (let i = 0; i < textNorm.length; i += 1) {
    const char = textNorm[i];
    if (char >= "A" && char <= "Z") {
      const shift = keyNorm[keyIndex % keyNorm.length].charCodeAt(0) - 65;
      const encrypted = String.fromCharCode(((char.charCodeAt(0) - 65 + shift) % 26) + 65);
      result += encrypted;
      keyIndex += 1;
    } else {
      result += char;
    }
  }

  return result;
}

function buildQuotaCounts(total, quotas) {
  const entries = Object.entries(quotas);
  const counts = {};
  let assigned = 0;

  for (const [name, quota] of entries) {
    const raw = total * quota;
    const base = Math.floor(raw);
    counts[name] = {
      value: base,
      remainder: raw - base,
    };
    assigned += base;
  }

  const missing = total - assigned;
  if (missing > 0) {
    entries
      .slice()
      .sort((a, b) => counts[b[0]].remainder - counts[a[0]].remainder)
      .slice(0, missing)
      .forEach(([name]) => {
        counts[name].value += 1;
      });
  }

  const flattened = {};
  for (const [name, info] of Object.entries(counts)) {
    flattened[name] = info.value;
  }
  return flattened;
}

function buildSchedule(quotaCounts, rng) {
  const schedule = [];
  for (const [name, count] of Object.entries(quotaCounts)) {
    for (let i = 0; i < count; i += 1) {
      schedule.push(name);
    }
  }

  // Fisher-Yates-Shuffle mit seeded RNG, damit die Verteilung stabil bleibt,
  // aber Fallreihenfolge trotzdem nicht trivial blockweise ist.
  for (let i = schedule.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(0, i);
    const swap = schedule[i];
    schedule[i] = schedule[j];
    schedule[j] = swap;
  }

  return schedule;
}

function repeatToLength(base, targetLength) {
  let output = "";
  while (output.length < targetLength) {
    output += base;
  }
  return output.slice(0, targetLength).toUpperCase();
}

function relationAwareKey(relation, baseKey, textLetterLength, rng) {
  const normalizedBase = baseKey.replace(/[^A-Za-z]/g, "").toUpperCase();
  const effectiveBase = normalizedBase.slice(0, 1) || "A";
  const baseLength = effectiveBase.length;

  if (relation === "key < text") {
    const cap = Math.max(1, textLetterLength - 1);
    const choices = [1, 2, 3, 4].filter((value) => value < cap);
    const targetLength = choices.length > 0 ? rng.pick(choices) : 1;
    return {
      actualKey: repeatToLength(effectiveBase, targetLength),
      keyLengthHint: baseLength,
    };
  }

  if (relation === "key > text/2") {
    const minLength = Math.max(2, Math.floor(textLetterLength / 2) + 1);
    const maxLength = Math.max(minLength, textLetterLength - 1);
    let targetLength = minLength;

    // Multiples von baseLength halten den effektiven Schlüsselzyklus klein,
    // damit der unhinted-Pfad weiterhin realistisch lösbar bleibt.
    const multiples = [];
    for (let length = minLength; length <= maxLength; length += 1) {
      if (length % baseLength === 0) {
        multiples.push(length);
      }
    }

    if (multiples.length > 0) {
      targetLength = rng.pick(multiples);
    }

    return {
      actualKey: repeatToLength(effectiveBase, targetLength),
      keyLengthHint: baseLength,
    };
  }

  // relation === "key == text"
  return {
    actualKey: repeatToLength(effectiveBase, textLetterLength),
    keyLengthHint: baseLength,
  };
}

function generateVigenereDataset(n, seed = 0) {
  const rng = new SeededRNG(seed);
  const bucketCounts = buildQuotaCounts(n, BUCKET_QUOTAS);
  const relationCounts = buildQuotaCounts(n, RELATION_QUOTAS);
  const bucketSchedule = buildSchedule(bucketCounts, rng);
  const relationSchedule = buildSchedule(relationCounts, rng);

  const dataset = [];
  for (let id = 0; id < n; id += 1) {
    const bucket = bucketSchedule[id];
    const relation = relationSchedule[id];
    const plaintext = rng.pick(PLAINTEXT_BY_BUCKET[bucket]);
    const letterLength = normalizeLetterCount(plaintext);
    const baseKey = rng.pick(BASE_KEYS);
    const keyInfo = relationAwareKey(relation, baseKey, letterLength, rng);

    dataset.push({
      id,
      plaintext,
      ciphertext: vigenereEncrypt(plaintext, keyInfo.actualKey),
      key: keyInfo.actualKey,
      keyLength: keyInfo.keyLengthHint,
      actualKeyLength: keyInfo.actualKey.length,
      bucket,
      keyRelation: relation,
      baseKey: baseKey.toUpperCase(),
    });
  }

  return dataset;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SeededRNG,
    generateVigenereDataset,
  };
}
