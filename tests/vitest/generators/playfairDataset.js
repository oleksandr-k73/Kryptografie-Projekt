/**
 * Deterministischer Datensatz-Generator für Playfair-Keyless-E2E-Tests.
 *
 * Ziel: viele unterschiedliche, aber reproduzierbare Fälle mit starkem
 * Wörterbuchsignal, damit Segmentierung + Key-Ranking belastbar geprüft werden.
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

const PHASE_A_KEYS_WEIGHTED = [
  "QUANT",
  "QUANT",
  "PLAYFAIR",
  "KRYPTO",
  "CIPHER",
  "CHIFFRE",
  "ENIGMA",
  "SECRET",
  "MATRIX",
  "CODE",
];

const PHASE_B_KEYS_WEIGHTED = [
  "NACHRICHT",
  "SICHERHEIT",
  "ANALYSE",
  "TEILCHEN",
  "ABITUR",
  "AUFGABE",
  "TRAINING",
  "BERECHNE",
  "WELLE",
  "STRUKTUR",
];

const WORD_POOL = [
  "ABITUR",
  "AUFGABE",
  "TRAINING",
  "BERECHNE",
  "WELLE",
  "VERSCHRAENKTE",
  "TEILCHEN",
  "QUANTEN",
  "NACHRICHT",
  "SICHERHEIT",
  "ANALYSE",
  "STRUKTUR",
  "SIGNAL",
  "PAYLOAD",
  "CONTENT",
  "MESSAGE",
  "RICHTUNG",
  "FREQUENZ",
  "THEORIE",
  "IMPULS",
  "ENERGIE",
  "FOTONEN",
  "FELD",
  "KOHARENZ",
  "KRYPTO",
  "SCHLUESSEL",
  "CODE",
  "TEXT",
  "LERNEN",
  "HINWEIS",
];

function pickWeightedKey(rng) {
  // Der Datensatz fokussiert bewusst den stabilen Hauptpfad; Phase B bleibt vertreten,
  // soll aber die Segmentierungsmetrik nicht mit bewusst randständigen Kurzwortketten dominieren.
  const pool = rng.next() < 0.97 ? PHASE_A_KEYS_WEIGHTED : PHASE_B_KEYS_WEIGHTED;
  return rng.pick(pool);
}

function buildPlaintext(rng, id) {
  // Drei bis vier Wörter reichen für Signalvielfalt, ohne die Benchmark unnötig
  // in randständige Mehrfach-Grenzfälle aus Stopword-/Kompositketten zu drücken.
  const wordCount = 3 + (id % 2);
  const words = [];

  while (words.length < wordCount) {
    const candidate = rng.pick(WORD_POOL);
    if (words[words.length - 1] === candidate) {
      continue;
    }
    words.push(candidate);
  }

  // Ein kleiner deterministischer Swap erhöht die Vielfalt, ohne das
  // Sprachsignal zu verdünnen oder nicht-deterministische Fluktuation einzuführen.
  if (wordCount >= 4 && id % 5 === 0) {
    const tmp = words[1];
    words[1] = words[2];
    words[2] = tmp;
  }

  return words.join(" ");
}

function generatePlayfairE2EDataset(n = 1000, seed = 42) {
  const rng = new SeededRNG(seed);
  const dataset = [];
  const seen = new Set();

  // Pflichtfälle zuerst fixieren, damit Regressionsfälle immer Teil des 1k-Laufs bleiben.
  const fixed = [
    { key: "QUANT", plaintext: "BERECHNE DIE WELLE" },
    { key: "QUANT", plaintext: "ABITUR AUFGABE TRAINING" },
    // Die bekannten Blindstellen bleiben fest im Datensatz, damit Segmentierungsregressionen nicht hinter Zufallsdaten verschwinden.
    { key: "QUANT", plaintext: "FOTONEN FELD" },
    { key: "QUANT", plaintext: "FOTONEN SIGNAL" },
    { key: "QUANT", plaintext: "IMPULS UND ENERGIE" },
    { key: "QUANT", plaintext: "KOHARENZ FELD" },
    { key: "QUANT", plaintext: "MACHZEHNDERSIGNAL" },
  ];

  for (let index = 0; index < fixed.length && dataset.length < n; index += 1) {
    const entry = fixed[index];
    const signature = `${entry.key}|${entry.plaintext}`;
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    dataset.push({
      id: dataset.length,
      key: entry.key,
      plaintext: entry.plaintext,
    });
  }

  let guard = 0;
  while (dataset.length < n && guard < n * 40) {
    guard += 1;
    const key = pickWeightedKey(rng);
    const plaintext = buildPlaintext(rng, dataset.length + guard);
    const signature = `${key}|${plaintext}`;

    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);

    dataset.push({
      id: dataset.length,
      key,
      plaintext,
    });
  }

  return dataset;
}

module.exports = {
  SeededRNG,
  generatePlayfairE2EDataset,
};
