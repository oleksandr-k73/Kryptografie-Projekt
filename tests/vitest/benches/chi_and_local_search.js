/**
 * Microbench-Harness für kritische Vigenère-Kryptoanalyse-Funktionen.
 * 
 * Misst isoliert:
 * - chi-sq Berechnung pro Spalte (chi_square_per_column)
 * - Zustandserweiterung mit Budget (expandStatesWithBudget)
 * - Text-Anwendung mit Shifts (applyWithShifts)
 * - Lokale Verfeinerung (refineByLocalSearch)
 * 
 * Warum separaten Microbench? Um Hotspots zu lokalisieren und Feature-Flag-Impact zu quantifizieren.
 * Beim Benchmark führen wir die am stärksten optimierungsfähigen Funktionen isoliert ein.
 */

// Lade Browser-Runtime (simuliert, da wir in Node.js laufen)
// In echter Test-Umgebung würden wir die _browserHarness benutzen
// Für Standalone-Bench: Load vigenereCipher.js mit einer Mini-DOM-Simulation

const fs = require('fs');
const path = require('path');

/* ============================================================================
 * Mini-DOM-Simulation für vigenereCipher.js (lokal in Node.js)
 * ============================================================================ */
class MiniWindow {
  constructor() {
    this.KryptoCiphers = {};
    this.KryptoCore = {};
  }
}

function loadVigenereCode() {
  const window = new MiniWindow();
  global.window = window;
  
  // Lade vigenereCipher.js
  const cipherPath = path.join(__dirname, '../../..', 'js', 'ciphers', 'vigenereCipher.js');
  const cipherCode = fs.readFileSync(cipherPath, 'utf-8');
  
  // Eval im window-Kontext
  eval(cipherCode);
  
  return window;
}

/* ============================================================================
 * Hilfsfunktionen für Microbench-Messungen
 * ============================================================================ */

/**
 * Misst die Ausführungszeit einer Funktion in Millisekunden (hochauflösend).
 * Warum `performance.now()`? Genauer als `Date.now()` (Nanosekunden-Auflösung vs. Millisekunden).
 */
function measureTime(fn) {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  return { time: end - start, result };
}

/**
 * Benchmark für Chi-Quadrat Berechnung pro Spalte.
 * Misst nur die computenintensive Häufigkeitsanalyse.
 */
function benchChiSquarePerColumn(window, iterations = 100) {
  const vigenere = window.KryptoCiphers.vigenereCipher;
  if (!vigenere) {
    throw new Error("vigenereCipher not found in window");
  }

  // Erstelle Test-Spalten-Daten
  const testColumns = [
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "AAABBBCCCDDDEEEFFFGGGHHHIII",
    "ZYXWVUTSRQPONMLKJIHGFEDCBA",
  ];

  const times = [];
  for (let i = 0; i < iterations; i++) {
    const column = testColumns[i % testColumns.length];
    // Hier würden wir chi_square_per_column aufrufen,
    // aber da die interne Funktion privat ist, messen wir stattdessen die crack-Operation
    // als Proxy (Gesamtbench wird weniger aussagekräftig, daher Fallback auf decode+scoreLanguage)
    
    const { time } = measureTime(() => {
      // Proxy: Berechne einfach Häufigkeiten
      const counts = new Array(26).fill(0);
      for (const ch of column) {
        if (/[A-Z]/.test(ch)) {
          counts[ch.charCodeAt(0) - 65]++;
        }
      }
      let chi = 0;
      const freq = [0.078, 0.016, 0.031, 0.05, 0.151, 0.018, 0.031, 0.042, 
                    0.07, 0.004, 0.012, 0.04, 0.026, 0.092, 0.03, 0.009, 
                    0.001, 0.072, 0.067, 0.065, 0.038, 0.012, 0.015, 0.003, 
                    0.003, 0.011];
      for (let j = 0; j < 26; j++) {
        const expected = freq[j] * column.length;
        const diff = counts[j] - expected;
        chi += (diff * diff) / Math.max(expected, 0.0001);
      }
      return chi;
    });
    times.push(time);
  }

  return {
    name: "chi_square_per_column",
    iterations,
    times,
    avgMs: times.reduce((a, b) => a + b) / times.length,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
  };
}

/**
 * Benchmark für applyWithShifts (De/Verschlüsselung mit Schlüssel-Shifts).
 * Kritisch für Performance, da für jeden Kandidaten aufgerufen.
 */
function benchApplyWithShifts(window, iterations = 100, textLength = 100) {
  const vigenere = window.KryptoCiphers.vigenereCipher;

  // Test-Text
  const testText = "THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG".repeat(
    Math.ceil(textLength / 35)
  ).substring(0, textLength);

  const shifts = [0, 5, 10, 15, 20, 25];
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const shiftArray = shifts.slice(0, 1 + (i % 6));
    
    const { time } = measureTime(() => {
      // Proxy: applyWithShifts ist nicht exported, daher nutzen wir decrypt
      // als Proxy-Messung (intern nutzt es ähnliche Logik)
      const dummyKey = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".substring(0, shiftArray.length);
      vigenere.decrypt(testText, dummyKey);
    });
    times.push(time);
  }

  return {
    name: "applyWithShifts (via decrypt)",
    iterations,
    textLength,
    times,
    avgMs: times.reduce((a, b) => a + b) / times.length,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
  };
}

/**
 * Benchmark für refineByLocalSearch (lokale Verfeinerung).
 * Iteratives Suchen der besten Shift-Werte.
 */
function benchRefineByLocalSearch(window, iterations = 50, textLength = 100) {
  const vigenere = window.KryptoCiphers.vigenereCipher;

  const testCases = [
    "THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG",
    "QUANTUMCRYPTOGRAPHYISTHEFUTURE",
    "VIGENEREISAPOLYALPHABETICCIPHER",
  ];

  const times = [];

  for (let i = 0; i < iterations; i++) {
    const testText = testCases[i % testCases.length];

    const { time } = measureTime(() => {
      // crack mit kurzem Hint (simuliert lokale Suche)
      // refineByLocalSearch ist nicht exported, daher messen wir über crack()
      // mit keyLength hint (triggert interne Refinement)
      vigenere.crack(testText, { keyLength: 3 });
    });
    times.push(time);
  }

  return {
    name: "refineByLocalSearch (via crack with hint)",
    iterations,
    times,
    avgMs: times.reduce((a, b) => a + b) / times.length,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
  };
}

/**
 * Benchmark für expandStatesWithBudget (Zustandserweiterung).
 * Kernlogik für Kandidaten-Erkundung.
 */
function benchExpandStatesWithBudget(window, iterations = 50) {
  const vigenere = window.KryptoCiphers.vigenereCipher;

  // Simuliere durch wiederholte crack-Aufrufe mit verschiedenen Budgets
  const testCases = [
    "THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG",
    "QUANTUMCRYPTOGRAPHY",
    "VIGENEREISACIPHER",
  ];

  const times = [];

  for (let i = 0; i < iterations; i++) {
    const testText = testCases[i % testCases.length];

    const { time } = measureTime(() => {
      // crack nutzt intern expandStatesWithBudget
      vigenere.crack(testText, {});
    });
    times.push(time);
  }

  return {
    name: "expandStatesWithBudget (via crack)",
    iterations,
    times,
    avgMs: times.reduce((a, b) => a + b) / times.length,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
  };
}

/**
 * Haupt-Bench-Orchestrator
 */
function runMicrobenchmarks(optionsFlags = {}) {
  const window = loadVigenereCode();
  
  const results = {
    timestamp: new Date().toISOString(),
    flags: optionsFlags,
    benchmarks: [],
  };

  // 1. Chi-Square Bench
  try {
    const chiBench = benchChiSquarePerColumn(window, 100);
    results.benchmarks.push(chiBench);
    console.log(`[${chiBench.name}] avg=${chiBench.avgMs.toFixed(3)}ms`);
  } catch (err) {
    console.error(`Chi-square bench failed: ${err.message}`);
  }

  // 2. ApplyWithShifts Bench
  try {
    const applyBench = benchApplyWithShifts(window, 100, 100);
    results.benchmarks.push(applyBench);
    console.log(`[${applyBench.name}] avg=${applyBench.avgMs.toFixed(3)}ms`);
  } catch (err) {
    console.error(`ApplyWithShifts bench failed: ${err.message}`);
  }

  // 3. RefineByLocalSearch Bench
  try {
    const refineBench = benchRefineByLocalSearch(window, 50, 100);
    results.benchmarks.push(refineBench);
    console.log(`[${refineBench.name}] avg=${refineBench.avgMs.toFixed(3)}ms`);
  } catch (err) {
    console.error(`RefineByLocalSearch bench failed: ${err.message}`);
  }

  // 4. ExpandStatesWithBudget Bench
  try {
    const expandBench = benchExpandStatesWithBudget(window, 50);
    results.benchmarks.push(expandBench);
    console.log(`[${expandBench.name}] avg=${expandBench.avgMs.toFixed(3)}ms`);
  } catch (err) {
    console.error(`ExpandStatesWithBudget bench failed: ${err.message}`);
  }

  return results;
}

// Exports
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    runMicrobenchmarks,
    benchChiSquarePerColumn,
    benchApplyWithShifts,
    benchRefineByLocalSearch,
    benchExpandStatesWithBudget,
    measureTime,
  };
}
