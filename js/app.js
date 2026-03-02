(function initApp(global) {
  const core = global.KryptoCore || {};
  const ciphers = global.KryptoCiphers || {};

  if (!core.CipherRegistry || !core.parseInputFile) {
    throw new Error("App-Komponenten wurden nicht korrekt geladen.");
  }

  const registry = new core.CipherRegistry();

  const elements = {
    dropzone: document.getElementById("dropzone"),
    fileInput: document.getElementById("fileInput"),
    fileStatus: document.getElementById("fileStatus"),
    inputText: document.getElementById("inputText"),
    modeSelect: document.getElementById("modeSelect"),
    cipherSelect: document.getElementById("cipherSelect"),
    keyLabel: document.querySelector('label[for="keyInput"]'),
    keyInput: document.getElementById("keyInput"),
    keyHint: document.getElementById("keyHint"),
    crackLengthWrap: document.getElementById("crackLengthWrap"),
    crackLengthInput: document.getElementById("crackLengthInput"),
    crackLengthHint: document.getElementById("crackLengthHint"),
    cipherInfoTitle: document.getElementById("cipherInfoTitle"),
    cipherInfoPurpose: document.getElementById("cipherInfoPurpose"),
    cipherInfoHow: document.getElementById("cipherInfoHow"),
    cipherInfoCrack: document.getElementById("cipherInfoCrack"),
    cipherInfoUse: document.getElementById("cipherInfoUse"),
    candidateSection: document.getElementById("candidateSection"),
    candidateStatus: document.getElementById("candidateStatus"),
    candidateList: document.getElementById("candidateList"),
    runButton: document.getElementById("runButton"),
    outputText: document.getElementById("outputText"),
    resultInfo: document.getElementById("resultInfo"),
    copyButton: document.getElementById("copyButton"),
  };

  function hasCipherShape(value) {
    return (
      value &&
      typeof value === "object" &&
      typeof value.id === "string" &&
      typeof value.name === "string" &&
      typeof value.encrypt === "function" &&
      typeof value.decrypt === "function" &&
      typeof value.crack === "function"
    );
  }

  function registerCiphers() {
    const all = Object.values(ciphers).filter(hasCipherShape);

    if (all.length === 0) {
      throw new Error("Kein Cipher-Modul gefunden.");
    }

    for (const cipher of all) {
      registry.register(cipher);
    }
  }

  function getSelectedCipher() {
    return registry.get(elements.cipherSelect.value);
  }

  function populateCipherSelect() {
    for (const cipher of registry.list()) {
      const option = document.createElement("option");
      option.value = cipher.id;
      option.textContent = cipher.name;
      elements.cipherSelect.append(option);
    }
  }

  /**
   * Update the key input UI to reflect the selected cipher's key requirements and the chosen mode.
   *
   * Adjusts the key label, placeholder, enabled/disabled state, input value, and hint text based on:
   * - whether a cipher is selected (no-op if none),
   * - whether the selected cipher supports a key,
   * - and whether the UI is in "encrypt" or "decrypt" mode.
   */
  function refreshKeyUI() {
    const mode = elements.modeSelect.value;
    const cipher = getSelectedCipher();

    if (!cipher) {
      return;
    }

    const supportsKey = Boolean(cipher.supportsKey);
    const label = cipher.keyLabel || "Schlüssel";
    const placeholder = cipher.keyPlaceholder || "z. B. 3";

    const suffix = mode === "encrypt" ? " (erforderlich)" : " (optional)";
    elements.keyLabel.textContent = supportsKey ? `${label}${suffix}` : "Schlüssel";
    elements.keyInput.placeholder = placeholder;
    elements.keyInput.disabled = !supportsKey;

    if (!supportsKey) {
      elements.keyInput.value = "";
      elements.keyHint.textContent =
        "Dieses Verfahren nutzt keinen Schlüssel. Beim Entschlüsseln wird automatisch geknackt.";
      return;
    }

    if (mode === "decrypt") {
      elements.keyHint.textContent =
        "Leer lassen, um den Schlüssel automatisch zu knacken.";
    } else {
      elements.keyHint.textContent = "Beim Verschlüsseln ist ein Schlüssel erforderlich.";
    }
  }

  /**
   * Update the crack-length input UI based on the selected cipher, current mode, and whether a manual key is present.
   *
   * Shows and enables the crack-length controls only when a cipher is selected that advertises `supportsCrackLengthHint`, the UI mode is "decrypt", and no manual key has been entered; otherwise hides and disables the controls. When shown, sets the label text (using `cipher.crackLengthLabel` or "Schlüssellänge" as a default), the input placeholder (using `cipher.crackLengthPlaceholder` or "z. B. 6"), and a brief hint explaining the optional nature and benefit of providing a length.
   */
  function refreshCrackLengthUI() {
    const mode = elements.modeSelect.value;
    const cipher = getSelectedCipher();
    const hasManualKey = elements.keyInput.value.trim() !== "";

    const show =
      Boolean(cipher && cipher.supportsCrackLengthHint) &&
      mode === "decrypt" &&
      !hasManualKey;

    elements.crackLengthWrap.hidden = !show;
    elements.crackLengthInput.disabled = !show;

    if (!show) {
      return;
    }

    const label = cipher.crackLengthLabel || "Schlüssellänge";
    const placeholder = cipher.crackLengthPlaceholder || "z. B. 6";
    elements.crackLengthWrap
      .querySelector('label[for="crackLengthInput"]')
      .textContent = `${label} fürs Knacken (optional)`;
    elements.crackLengthInput.placeholder = placeholder;
    elements.crackLengthHint.textContent =
      "Wenn bekannt, beschleunigt und verbessert das Knacken.";
  }

  /**
   * Populate the cipher information panel based on the currently selected cipher.
   *
   * Updates the title and the purpose/process/crack/use-case fields in the UI; when a selected cipher lacks
   * specific info fields, displays a short default "Keine Beschreibung vorhanden." message for that field.
   */
  function refreshCipherInfo() {
    const cipher = getSelectedCipher();
    if (!cipher) {
      return;
    }

    const info = cipher.info || {};
    elements.cipherInfoTitle.textContent = `${cipher.name} - Verfahrensinfo`;
    elements.cipherInfoPurpose.textContent = `Was ist das? ${info.purpose || "Keine Beschreibung vorhanden."}`;
    elements.cipherInfoHow.textContent = `Wie funktioniert es? ${info.process || "Keine Beschreibung vorhanden."}`;
    elements.cipherInfoCrack.textContent = `Wie wird geknackt? ${info.crack || "Keine Beschreibung vorhanden."}`;
    elements.cipherInfoUse.textContent = `Wann passt es? ${info.useCase || "Keine Beschreibung vorhanden."}`;
  }

  function setStatus(message) {
    elements.resultInfo.textContent = message;
  }

  /**
   * Update the file status display with a message.
   * @param {string} message - Text to show in the file status UI element.
   */
  function setFileStatus(message) {
    elements.fileStatus.textContent = message;
  }

  /**
   * Hide the candidate UI and clear its contents.
   *
   * Hides the candidate section, clears the candidate status message, and removes all candidate list items.
   */
  function hideCandidates() {
    elements.candidateSection.hidden = true;
    elements.candidateStatus.textContent = "";
    elements.candidateList.innerHTML = "";
  }

  /**
   * Format a numeric score for display.
   * @param {number} value - The score to format.
   * @returns {string} The score rounded to two decimal places, or "-" if `value` is not a finite number.
   */
  function formatScore(value) {
    if (!Number.isFinite(value)) {
      return "-";
    }
    return value.toFixed(2);
  }

  /**
   * Normalize a cracking result into a uniform, confidence-sorted list of candidates.
   *
   * Accepts an object that either contains a `candidates` array or single-candidate fields
   * (`key`, `text`, `confidence`) and returns an array of candidate objects with
   * numeric `confidence` values sorted from highest to lowest.
   *
   * @param {Object} cracked - Cracking result to normalize.
   * @param {Array<Object>} [cracked.candidates] - Optional array of candidate objects.
   * @param {*} [cracked.key] - Fallback candidate key when `candidates` is not provided.
   * @param {string} [cracked.text] - Fallback candidate text when `candidates` is not provided.
   * @param {*} [cracked.confidence] - Fallback candidate confidence when `candidates` is not provided.
   * @returns {Array<{key: *, text: string, confidence: number}>} An array of candidates that have a string `text`, with `confidence` coerced to a number (default 0), sorted by descending confidence.
   */
  function normalizeCrackCandidates(cracked) {
    const list = Array.isArray(cracked.candidates)
      ? cracked.candidates
      : [
          {
            key: cracked.key,
            text: cracked.text,
            confidence: cracked.confidence,
          },
        ];

    return list
      .filter((candidate) => candidate && typeof candidate.text === "string")
      .map((candidate) => ({
        key: candidate.key,
        text: candidate.text,
        confidence: Number(candidate.confidence) || 0,
      }))
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Update the candidate UI: show a ranked list of crack candidates and a status message, or hide the section if there are not multiple candidates.
   *
   * Renders up to five candidates into the candidate list, including key (if present), formatted confidence score, dictionary coverage (if present), and candidate text. If no candidate shows dictionary coverage, sets a contextual hint that suggests providing or checking a key length; the status text differs depending on whether an external dictionary API was used.
   *
   * @param {Array<{key?: string|number, text: string, confidence: number, dictionary?: {coverage: number}}>} candidates - Ordered candidate objects; each may include an optional `key`, a `text` result, a numeric `confidence`, and an optional `dictionary.coverage` (0–1).
   * @param {boolean} apiAvailable - True when an external dictionary-scoring API was available and used for re-ranking; false when ranking relied on local scoring.
   * @param {{keyLengthHint?: boolean}|null} context - Optional context that may include `keyLengthHint` to indicate whether a suggested key length was provided to the cracker.
   */
  function renderCandidates(candidates, apiAvailable, context) {
    if (!candidates || candidates.length <= 1) {
      hideCandidates();
      return;
    }

    elements.candidateSection.hidden = false;
    elements.candidateList.innerHTML = "";

    const top = candidates.slice(0, 5);
    for (const candidate of top) {
      const item = document.createElement("li");
      const keyPart =
        candidate.key != null ? `Schlüssel: ${candidate.key} | ` : "";
      const dictPart = candidate.dictionary
        ? ` | Wörterbuch: ${(candidate.dictionary.coverage * 100).toFixed(0)}%`
        : "";
      item.textContent = `${keyPart}Score: ${formatScore(
        candidate.confidence
      )}${dictPart} | ${candidate.text}`;
      elements.candidateList.append(item);
    }

    const bestCoverage =
      candidates[0] && candidates[0].dictionary
        ? candidates[0].dictionary.coverage
        : 0;

    if (bestCoverage === 0) {
      const hintText =
        context && context.keyLengthHint
          ? " Prüfe, ob die Schlüssellänge korrekt ist."
          : " Gib wenn möglich eine Schlüssellänge an.";
      elements.candidateStatus.textContent = apiAvailable
        ? `Kein Kandidat enthält erkannte Wörterbuchwörter.${hintText}`
        : `Kein Kandidat enthält erkannte Wörterbuchwörter (API nicht verfügbar, lokales Wörterbuch aktiv).${hintText}`;
      return;
    }

    elements.candidateStatus.textContent = apiAvailable
      ? "Kandidaten wurden mit Wörterbuch-API nachbewertet."
      : "Kandidaten basieren auf lokalem Sprach-Scoring (API nicht verfügbar).";
  }

  /**
   * Convert a language tag or code to a short normalized language hint.
   *
   * @param {string|null|undefined} rawLanguage - Input language tag or code (e.g. "de-DE", "en", "EN-us"); may be null/undefined.
   * @returns {"de"|"en"|null} `"de"` if the input starts with "de", `"en"` if it starts with "en", or `null` otherwise.
   */
  function normalizeLanguageTag(rawLanguage) {
    const normalized = String(rawLanguage || "").toLowerCase();
    if (normalized.startsWith("de")) {
      return "de";
    }
    if (normalized.startsWith("en")) {
      return "en";
    }
    return null;
  }

  /**
   * Derives up to three short language tags from input text and the browser's language settings.
   *
   * Checks the text for simple German/English cues, adds browser language preferences, and
   * returns a short ordered list (highest-confidence first) with a maximum of three entries.
   * @param {string} text - Arbitrary input text used to infer language hints.
   * @returns {string[]} An array of short language tags (e.g., `"de"`, `"en"`), ordered by confidence, up to three items.
   */
  function deriveLanguageHints(text) {
    const hints = [];
    const seen = new Set();
    const pushHint = (hint) => {
      if (!hint || seen.has(hint)) {
        return;
      }
      seen.add(hint);
      hints.push(hint);
    };

    const lower = String(text || "").toLowerCase();
    if (/[äöüß]/i.test(lower) || /\b(der|die|und|nicht|ist|ein)\b/.test(lower)) {
      pushHint("de");
    }
    if (/\b(the|and|you|not|is|to)\b/.test(lower)) {
      pushHint("en");
    }

    const browserLanguages = Array.isArray(navigator.languages)
      ? navigator.languages
      : [navigator.language];
    for (const entry of browserLanguages) {
      pushHint(normalizeLanguageTag(entry));
    }

    if (hints.length === 0) {
      pushHint("de");
      pushHint("en");
    } else {
      pushHint("de");
      pushHint("en");
    }

    return hints.slice(0, 3);
  }

  /**
   * Rank crack candidates using the dictionary scorer when available.
   * @param {Array<Object>} candidates - List of crack candidates, each typically containing `key`, `text`, and `confidence` fields.
   * @param {string} sourceText - The original ciphertext used to derive language hints for scoring.
   * @return {{rankedCandidates: Array<Object>, bestCandidate: Object|null, apiAvailable: boolean}} An object with `rankedCandidates` (the candidates ordered by score or the original list if scoring is unavailable), `bestCandidate` (the top candidate or `null` if none), and `apiAvailable` (`true` if the dictionary scorer was used, `false` otherwise).
   */
  async function rankCandidatesWithDictionary(candidates, sourceText) {
    const scorer = core.dictionaryScorer;
    if (!scorer || typeof scorer.rankCandidates !== "function") {
      return {
        rankedCandidates: candidates,
        bestCandidate: candidates[0] || null,
        apiAvailable: false,
      };
    }

    try {
      return await scorer.rankCandidates(candidates, {
        languageHints: deriveLanguageHints(sourceText),
      });
    } catch (_error) {
      return {
        rankedCandidates: candidates,
        bestCandidate: candidates[0] || null,
        apiAvailable: false,
      };
    }
  }

  /**
   * Parse a user-selected file, populate the input text area with its contents, and update the file status message.
   *
   * If the file's format is unrecognized but text was extracted, the status indicates the fallback; on success the status includes the detected format.
   * On read or parse failure the status is updated with the error message.
   * @param {File} file - The file selected by the user (from input or drop).
   */
  async function handleFile(file) {
    try {
      const parsed = await core.parseInputFile(file);
      elements.inputText.value = parsed.text;

      if (parsed.fallback) {
        setFileStatus(
          `Datei geladen (${file.name}). Unbekanntes Format, als Klartext übernommen.`
        );
      } else {
        setFileStatus(`Datei geladen (${file.name}, Format: ${parsed.format}).`);
      }
    } catch (error) {
      setFileStatus(`Datei konnte nicht gelesen werden: ${error.message}`);
    }
  }

  /**
   * Parse and return a key from the UI input for the given cipher when a key is supported and provided.
   * @param {Object} cipher - Cipher descriptor; expected to have a boolean `supportsKey` and an optional `parseKey(raw)` function.
   * @returns {*} The parsed key (using `cipher.parseKey` if available, otherwise the raw string), or `null` if the cipher does not support a key or no key was entered.
   */
  function parseOptionalKey(cipher) {
    if (!cipher.supportsKey) {
      return null;
    }

    const raw = elements.keyInput.value.trim();
    if (raw === "") {
      return null;
    }

    if (typeof cipher.parseKey === "function") {
      return cipher.parseKey(raw);
    }

    return raw;
  }

  /**
   * Build crack options from the UI crack-length input when the cipher accepts a length hint.
   *
   * If the selected cipher does not support a crack-length hint or the input is empty, returns an empty object.
   *
   * @param {object} cipher - The cipher descriptor to check for `supportsCrackLengthHint`.
   * @returns {Object} An options object; includes `keyLength` (positive integer) when a valid value was provided, otherwise `{}`.
   * @throws {Error} If the crack-length input is present but is not a positive integer.
   */
  function parseCrackOptions(cipher) {
    const options = {};

    if (!cipher.supportsCrackLengthHint) {
      return options;
    }

    const rawLength = elements.crackLengthInput.value.trim();
    if (rawLength === "") {
      return options;
    }

    const keyLength = Number.parseInt(rawLength, 10);
    if (Number.isNaN(keyLength) || keyLength <= 0) {
      throw new Error("Schlüssellänge muss eine positive ganze Zahl sein.");
    }

    options.keyLength = keyLength;
    return options;
  }

  /**
   * Execute the selected cipher operation (encrypt, decrypt, or crack) on the current input and update the UI with results and status.
   *
   * Performs input and selection validation, applies a provided key when present, and for decrypt-without-key runs the cipher's cracking flow (disabling the Run button while cracking, ranking candidates, rendering candidate UI, and updating output/status). Hides candidate UI for direct encrypt/decrypt, and includes contextual status messages (including Vigenère warnings and bruteforce fallback details) when applicable.
   *
   * @throws {Error} If the input text is empty: "Bitte zuerst Text eingeben oder eine Datei laden."
   * @throws {Error} If no valid cipher is selected: "Keine gültige Verschlüsselung ausgewählt."
   * @throws {Error} If encrypt mode is selected but a required key is missing: "Beim Verschlüsseln wird ein Schlüssel benötigt."
   */
  async function runCipher() {
    const text = elements.inputText.value;
    if (!text.trim()) {
      throw new Error("Bitte zuerst Text eingeben oder eine Datei laden.");
    }

    const mode = elements.modeSelect.value;
    const cipher = getSelectedCipher();
    if (!cipher) {
      throw new Error("Keine gültige Verschlüsselung ausgewählt.");
    }

    const key = parseOptionalKey(cipher);

    if (mode === "encrypt") {
      if (cipher.supportsKey && key == null) {
        throw new Error("Beim Verschlüsseln wird ein Schlüssel benötigt.");
      }

      const encrypted = cipher.encrypt(text, key);
      elements.outputText.value = encrypted;
      hideCandidates();
      setStatus(
        cipher.supportsKey
          ? `${cipher.name}: Text verschlüsselt (Schlüssel: ${key}).`
          : `${cipher.name}: Text verschlüsselt.`
      );
      return;
    }

    if (cipher.supportsKey && key != null) {
      const decrypted = cipher.decrypt(text, key);
      elements.outputText.value = decrypted;
      hideCandidates();
      setStatus(`${cipher.name}: Text entschlüsselt (Schlüssel: ${key}).`);
      return;
    }

    const crackOptions = parseCrackOptions(cipher);
    if (cipher.id === "vigenere") {
      setStatus("Vigenère: Bruteforce-Prüfung läuft gegebenenfalls, bitte warten ...");
    }

    // Die Deaktivierung verhindert Doppelstarts während langer Crack-Läufe;
    // ohne diesen Guard entstehen leicht konkurrierende Berechnungen und UI-Rennen.
    elements.runButton.disabled = true;
    try {
      // Das Rendering muss vor dem CPU-intensiven Crack einmal zurück an den Browser,
      // damit der Wartehinweis sichtbar ist, bevor die Hauptschleife blockiert.
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const cracked = cipher.crack(text, crackOptions);
      const localCandidates = normalizeCrackCandidates(cracked);
      const ranked = await rankCandidatesWithDictionary(localCandidates, text);
      const rankedCandidates =
        ranked.rankedCandidates && ranked.rankedCandidates.length > 0
          ? ranked.rankedCandidates
          : localCandidates;
      const bestCandidate =
        ranked.bestCandidate || rankedCandidates[0] || cracked;

      elements.outputText.value = bestCandidate.text;
      const shortVigenereWarning =
        cipher.id === "vigenere" &&
        !crackOptions.keyLength &&
        (text.match(/[A-Za-z]/g) || []).length < 18;
      renderCandidates(rankedCandidates, ranked.apiAvailable, {
        keyLengthHint: crackOptions.keyLength,
      });

      const search = cracked && cracked.search ? cracked.search : null;
      const fallbackKeyLength = Number.isFinite(search && search.bruteforceFallbackKeyLength)
        ? Math.max(1, Math.floor(search.bruteforceFallbackKeyLength))
        : null;
      const fallbackCombosVisited = Number.isFinite(search && search.bruteforceCombosVisited)
        ? Math.max(0, Math.floor(search.bruteforceCombosVisited))
        : 0;
      // Nur validierte Zahlen werden formatiert, damit Statusmeldungen nie NaN/undefined zeigen.
      const fallbackElapsedMs = Number.isFinite(search && search.bruteforceElapsedMs)
        ? Math.max(0, Math.round(search.bruteforceElapsedMs))
        : 0;
      const fallbackSuffix =
        search && search.bruteforceFallbackTriggered
          ? ` Bruteforce-Fallback aktiv (Länge ${fallbackKeyLength == null ? "unbekannt" : fallbackKeyLength}, ${fallbackCombosVisited} Kombinationen, ${fallbackElapsedMs} ms).`
          : "";

      if (bestCandidate.key != null) {
        const suffix = shortVigenereWarning
          ? " Hinweis: Sehr kurzer Text, Ergebnis kann unzuverlässig sein."
          : "";
        setStatus(
          `${cipher.name}: Schlüssel geknackt (${bestCandidate.key}), Text entschlüsselt.${suffix}${fallbackSuffix}`
        );
      } else {
        setStatus(`${cipher.name}: Text automatisch geknackt und entschlüsselt.${fallbackSuffix}`);
      }
    } finally {
      elements.runButton.disabled = false;
    }
  }

  async function copyOutput() {
    const text = elements.outputText.value;
    if (!text) {
      setStatus("Keine Ausgabe zum Kopieren vorhanden.");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setStatus("Ausgabe wurde in die Zwischenablage kopiert.");
    } catch (_error) {
      elements.outputText.focus();
      elements.outputText.select();
      const success = document.execCommand("copy");
      setStatus(
        success
          ? "Ausgabe wurde in die Zwischenablage kopiert."
          : "Kopieren fehlgeschlagen. Bitte manuell kopieren."
      );
    }
  }

  function setupDragAndDrop() {
    const { dropzone } = elements;

    dropzone.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropzone.classList.add("drag-active");
    });

    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("drag-active");
    });

    dropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      dropzone.classList.remove("drag-active");

      const [file] = event.dataTransfer.files;
      if (!file) {
        return;
      }
      handleFile(file);
    });
  }

  /**
   * Attach DOM event listeners for the main UI controls so user actions trigger file loading, mode/key/cipher updates, running the cipher, and copying output.
   *
   * - Listens for file selection and calls the file handler with the chosen file.
   * - Updates key and crack-length UI when mode or key input changes, and refreshes cipher info on cipher selection.
   * - Runs the cipher when the run button is clicked and reports any error message to the status area.
   * - Copies the output when the copy button is clicked.
   */
  function wireEvents() {
    elements.fileInput.addEventListener("change", (event) => {
      const [file] = event.target.files;
      if (file) {
        handleFile(file);
      }
    });

    elements.modeSelect.addEventListener("change", refreshKeyUI);
    elements.modeSelect.addEventListener("change", refreshCrackLengthUI);
    elements.keyInput.addEventListener("input", refreshCrackLengthUI);
    elements.cipherSelect.addEventListener("change", () => {
      refreshKeyUI();
      refreshCrackLengthUI();
      refreshCipherInfo();
    });
    elements.runButton.addEventListener("click", async () => {
      try {
        await runCipher();
      } catch (error) {
        setStatus(error.message);
      }
    });
    elements.copyButton.addEventListener("click", copyOutput);
  }

  /**
   * Initialize the application by registering ciphers, populating UI elements, wiring event handlers, enabling drag-and-drop, and setting initial key, crack-length, and cipher info UI state.
   */
  function init() {
    registerCiphers();
    populateCipherSelect();
    wireEvents();
    setupDragAndDrop();
    refreshKeyUI();
    refreshCrackLengthUI();
    refreshCipherInfo();
  }

  init();
})(window);
