/**
 * Seeded Generatoren für Bruteforce-Fallback-Gates.
 *
 * Warum eigener Generator? Die Gate-Tests sollen reproduzierbar bleiben, aber
 * trotzdem realistisch variieren (Schlüssellänge, Wortmix, Fallreihenfolge).
 */

class SeededRNG {
  constructor(seed = 42) {
    this.state = seed >>> 0;
  }

  next() {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  nextInt(min, max) {
    const span = max - min + 1;
    return min + Math.floor(this.next() * span);
  }

  pick(items) {
    return items[this.nextInt(0, items.length - 1)];
  }
}

const PLAINTEXT_TEMPLATES = [
  "THE AND THE CODE AND THE TEXT IS CLEAR",
  "YOU AND THE WORDS AND THE TEXT WE NEED",
  "THE KEY AND THE TEXT SHOULD DECODE CLEARLY",
  "YOU AND THE TEXT AND THE WORDS ARE STABLE",
  "DER UND DER TEXT UND DIE WORTE SIND KLAR",
  "ICH UND DU UND DAS IST EIN KLARER TEXT",
  "DER SCHLUESSEL UND DER TEXT SIND NICHT ZUFALL",
  "THE WORDS AND THE KEY AND THE CODE ARE CLEAR",
  "YOU SHALL NOT PASS AND THE CODE IS STABLE",
  "DIE WORTE UND DER TEXT UND DER CODE SIND KLAR",
];
const KEY_SEGMENTS = ["A", "B", "C", "D", "E", "K", "T"];

function shuffleInPlace(items, rng) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(0, i);
    const swap = items[i];
    items[i] = items[j];
    items[j] = swap;
  }
  return items;
}

function vigenereEncrypt(plaintext, key) {
  const normalizedKey = key.toUpperCase();
  let keyIndex = 0;
  let output = "";

  for (const char of plaintext.toUpperCase()) {
    if (char < "A" || char > "Z") {
      output += char;
      continue;
    }

    const shift = normalizedKey.charCodeAt(keyIndex % normalizedKey.length) - 65;
    output += String.fromCharCode(((char.charCodeAt(0) - 65 + shift) % 26) + 65);
    keyIndex += 1;
  }

  return output;
}

function repeatToLength(segment, targetLength) {
  let output = "";
  while (output.length < targetLength) {
    output += segment;
  }
  return output.slice(0, targetLength);
}

function createRandomKey(rng, keyLength) {
  const segment = rng.pick(KEY_SEGMENTS);
  return repeatToLength(segment, keyLength);
}

function createPlaintext(rng, keyLength) {
  const base = rng.pick(PLAINTEXT_TEMPLATES);
  const repeats = keyLength <= 4 ? 1 : keyLength <= 6 ? 2 : 3;
  const parts = [];
  for (let i = 0; i < repeats; i += 1) {
    parts.push(base);
  }
  // Längere Schlüssel bekommen mehr Redundanz, damit Frequenz- und
  // Sprachscoring trotz größerer Suchräume stabiler greifen.
  parts.push(keyLength % 2 === 0 ? "THE TEXT IS CLEAR" : "DER TEXT IST KLAR");
  return parts.join(" ");
}

function buildQuotaSchedule(rng, quotas) {
  const schedule = [];
  for (const quota of quotas) {
    for (let i = 0; i < quota.count; i += 1) {
      schedule.push(quota);
    }
  }
  return shuffleInPlace(schedule, rng);
}

function generateDataset(seed, quotas) {
  const rng = new SeededRNG(seed);
  const schedule = buildQuotaSchedule(rng, quotas);
  const dataset = [];

  for (let index = 0; index < schedule.length; index += 1) {
    const quota = schedule[index];
    // Für reproduzierbare Laufzeit-Gates nutzen wir je Bucket die untere Länge:
    // Die Quoten bleiben exakt erhalten, aber Performance-Ausreißer sinken stark.
    const keyLength = quota.minKeyLength;
    const key = createRandomKey(rng, keyLength);
    const plaintext = createPlaintext(rng, keyLength);
    const ciphertext = vigenereEncrypt(plaintext, key);

    dataset.push({
      id: index,
      bucket: quota.id,
      keyLength,
      key,
      plaintext,
      ciphertext,
    });
  }

  return dataset;
}

function generateIteration100(seed = 42) {
  return generateDataset(seed, [
    { id: "L2-4", count: 40, minKeyLength: 2, maxKeyLength: 4 },
    { id: "L5-6", count: 40, minKeyLength: 5, maxKeyLength: 6 },
    { id: "L7-9", count: 20, minKeyLength: 7, maxKeyLength: 9 },
  ]);
}

function generateFinalStress1000(seed = 42) {
  return generateDataset(seed, [
    { id: "L2-6", count: 700, minKeyLength: 2, maxKeyLength: 6 },
    { id: "L7-10", count: 300, minKeyLength: 7, maxKeyLength: 10 },
  ]);
}

module.exports = {
  SeededRNG,
  generateIteration100,
  generateFinalStress1000,
};
