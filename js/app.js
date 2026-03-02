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

  function setFileStatus(message) {
    elements.fileStatus.textContent = message;
  }

  function hideCandidates() {
    elements.candidateSection.hidden = true;
    elements.candidateStatus.textContent = "";
    elements.candidateList.innerHTML = "";
  }

  function formatScore(value) {
    if (!Number.isFinite(value)) {
      return "-";
    }
    return value.toFixed(2);
  }

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
      const fallbackSuffix =
        search &&
        search.bruteforceFallbackTriggered
          ? ` Bruteforce-Fallback aktiv (Länge ${search.bruteforceFallbackKeyLength}, ${search.bruteforceCombosVisited} Kombinationen, ${Math.round(search.bruteforceElapsedMs)} ms).`
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
