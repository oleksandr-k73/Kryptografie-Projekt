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
    rawOutputWrap: document.getElementById("rawOutputWrap"),
    rawOutputText: document.getElementById("rawOutputText"),
    resultInfo: document.getElementById("resultInfo"),
    copyButton: document.getElementById("copyButton"),
    rawCopyButton: document.getElementById("rawCopyButton"),
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
    const label = cipher.keyLabel || "SchlÃ¼ssel";
    const placeholder = cipher.keyPlaceholder || "z. B. 3";

    const suffix = mode === "encrypt" ? " (erforderlich)" : " (optional)";
    elements.keyLabel.textContent = supportsKey ? `${label}${suffix}` : "SchlÃ¼ssel";
    elements.keyInput.placeholder = placeholder;
    elements.keyInput.disabled = !supportsKey;

    if (!supportsKey) {
      elements.keyInput.value = "";
      elements.keyHint.textContent =
        "Dieses Verfahren nutzt keinen SchlÃ¼ssel. Beim EntschlÃ¼sseln wird automatisch geknackt.";
      return;
    }

    if (mode === "decrypt") {
      // Der Hinweis muss generisch bleiben, da mehrere Verfahren das Key-Feld fÃ¼rs Knacken wiederverwenden.
      elements.keyHint.textContent = cipher.reuseKeyForCrackHint
        ? `Leer lassen, um ${label.toLowerCase()} automatisch zu knacken. Mit Zahl wird direkt entschlÃ¼sselt.`
        : "Leer lassen, um den SchlÃ¼ssel automatisch zu knacken.";
    } else {
      elements.keyHint.textContent = "Beim VerschlÃ¼sseln ist ein SchlÃ¼ssel erforderlich.";
    }
  }

  function refreshCrackLengthUI() {
    const mode = elements.modeSelect.value;
    const cipher = getSelectedCipher();
    const hasManualKey = elements.keyInput.value.trim() !== "";

    const show =
      Boolean(cipher && cipher.supportsCrackLengthHint) &&
      !Boolean(cipher && cipher.reuseKeyForCrackHint) &&
      mode === "decrypt" &&
      !hasManualKey;

    elements.crackLengthWrap.hidden = !show;
    elements.crackLengthInput.disabled = !show;

    if (!show) {
      // Versteckte Altwerte dÃ¼rfen keine unbeabsichtigten Hints in Verfahren einspeisen,
      // die das SchlÃ¼ssel-Feld selbst schon als Crack-/Decrypt-Schalter verwenden.
      if (cipher && cipher.reuseKeyForCrackHint) {
        elements.crackLengthInput.value = "";
      }
      return;
    }

    const label = cipher.crackLengthLabel || "SchlÃ¼ssellÃ¤nge";
    const placeholder = cipher.crackLengthPlaceholder || "z. B. 6";
    elements.crackLengthWrap
      .querySelector('label[for="crackLengthInput"]')
      .textContent = `${label} fÃ¼rs Knacken (optional)`;
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

  function setRawOutput(rawText) {
    if (rawText == null) {
      // Rohtext bleibt verborgen, wenn keine klare Rohvariante existiert.
      elements.rawOutputWrap.hidden = true;
      elements.rawOutputText.value = "";
      elements.rawCopyButton.hidden = true;
      return;
    }

    elements.rawOutputWrap.hidden = false;
    elements.rawOutputText.value = rawText;
    elements.rawCopyButton.hidden = false;
  }

  function setOutputTexts(displayText, rawText) {
    // Segmentierter Text bleibt die Hauptausgabe; Rohtext wird separat angezeigt.
    elements.outputText.value = displayText;
    setRawOutput(rawText);
  }

  function segmentRawText(rawText, sourceText, options) {
    const opts = options && typeof options === "object" ? options : {};
    const trimmedRaw =
      opts.trimTrailingX === true ? String(rawText || "").replace(/X+$/g, "") : rawText;
    const scorer = core.dictionaryScorer;
    if (!scorer || typeof scorer.analyzeTextQuality !== "function") {
      return {
        displayText: trimmedRaw,
        rawText: rawText,
      };
    }

    try {
      const analysis = scorer.analyzeTextQuality(trimmedRaw, {
        languageHints: deriveLanguageHints(sourceText || trimmedRaw),
        maxWordLength: 40,
      });
      const displayText =
        analysis && typeof analysis.displayText === "string"
          ? analysis.displayText.trim()
          : trimmedRaw;
      return {
        displayText: displayText || trimmedRaw,
        rawText: rawText,
      };
    } catch (_error) {
      // Segmentierungsfehler sollen die Roh-Ausgabe nie blockieren.
      return {
        displayText: trimmedRaw,
        rawText: rawText,
      };
    }
  }

  function formatScore(value) {
    if (!Number.isFinite(value)) {
      return "-";
    }
    return value.toFixed(2);
  }

  function normalizeCrackCandidates(cracked) {
    // Rohtext wird durch den Ranking-Pfad gereicht, damit die finale Auswahl sichtbar bleibt.
    const list = Array.isArray(cracked.candidates)
      ? cracked.candidates
      : [
          {
            key: cracked.key,
            text: cracked.text,
            rawText: cracked.rawText,
            confidence: cracked.confidence,
          },
        ];

    // Reihenfolge der Kandidaten bleibt erhalten, damit Ties im Ranking deterministisch bleiben.
    return list
      .filter((candidate) => candidate && typeof candidate.text === "string")
      .map((candidate) => ({
        key: candidate.key,
        text: candidate.text,
        rawText: candidate.rawText,
        confidence: Number(candidate.confidence) || 0,
      }));
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
        candidate.key != null ? `SchlÃ¼ssel: ${candidate.key} | ` : "";
      const dictPart = candidate.dictionary
        ? ` | WÃ¶rterbuch: ${(candidate.dictionary.coverage * 100).toFixed(0)}%`
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
          ? " PrÃ¼fe, ob die SchlÃ¼ssellÃ¤nge korrekt ist."
          : " Gib wenn mÃ¶glich eine SchlÃ¼ssellÃ¤nge an.";
      elements.candidateStatus.textContent = apiAvailable
        ? `Kein Kandidat enthÃ¤lt erkannte WÃ¶rterbuchwÃ¶rter.${hintText}`
        : `Kein Kandidat enthÃ¤lt erkannte WÃ¶rterbuchwÃ¶rter (API nicht verfÃ¼gbar, lokales WÃ¶rterbuch aktiv).${hintText}`;
      return;
    }

    elements.candidateStatus.textContent = apiAvailable
      ? "Kandidaten wurden mit WÃ¶rterbuch-API nachbewertet."
      : "Kandidaten basieren auf lokalem Sprach-Scoring (API nicht verfÃ¼gbar).";
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
    if (/[Ã¤Ã¶Ã¼ÃŸ]/i.test(lower) || /\b(der|die|und|nicht|ist|ein)\b/.test(lower)) {
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

  async function enrichCrackOptionsWithKeyCandidates(cipher, sourceText, crackOptions) {
    if (!cipher || cipher.id !== "playfair") {
      return crackOptions;
    }

    const scorer = core.dictionaryScorer;
    if (!scorer || typeof scorer.getKeyCandidates !== "function") {
      return crackOptions;
    }

    try {
      // Der Playfair-Crack bleibt ohne Scorer funktional; optionale Key-Kandidaten
      // verbessern nur den Suchraum fÃ¼r Phase B und Ã¤ndern den UI-Fluss nicht.
      const maybeCandidates = await Promise.resolve(
        scorer.getKeyCandidates({
          languageHints: deriveLanguageHints(sourceText),
          text: sourceText,
          minLength: 4,
          maxLength: 12,
          limit: 260,
        })
      );

      if (Array.isArray(maybeCandidates) && maybeCandidates.length > 0) {
        crackOptions.keyCandidates = maybeCandidates;
      }
    } catch (_error) {
      // Optionales Enrichment darf den regulÃ¤ren Crack-Lauf nie blockieren.
    }

    return crackOptions;
  }

  async function handleFile(file) {
    try {
      const parsed = await core.parseInputFile(file);
      elements.inputText.value = parsed.text;

      if (parsed.fallback) {
        setFileStatus(
          `Datei geladen (${file.name}). Unbekanntes Format, als Klartext Ã¼bernommen.`
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

    if (!cipher.supportsCrackLengthHint || cipher.reuseKeyForCrackHint) {
      return options;
    }

    const rawLength = elements.crackLengthInput.value.trim();
    if (rawLength === "") {
      return options;
    }

    const keyLength = Number.parseInt(rawLength, 10);
    if (Number.isNaN(keyLength) || keyLength <= 0) {
      throw new Error("SchlÃ¼ssellÃ¤nge muss eine positive ganze Zahl sein.");
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
      throw new Error("Keine gÃ¼ltige VerschlÃ¼sselung ausgewÃ¤hlt.");
    }

    const key = parseOptionalKey(cipher);

    if (mode === "encrypt") {
      if (cipher.supportsKey && key == null) {
        throw new Error("Beim VerschlÃ¼sseln wird ein SchlÃ¼ssel benÃ¶tigt.");
      }

      const encrypted = cipher.encrypt(text, key);
      setOutputTexts(encrypted, null);
      hideCandidates();
      setStatus(
        cipher.supportsKey
          ? `${cipher.name}: Text verschlÃ¼sselt (SchlÃ¼ssel: ${key}).`
          : `${cipher.name}: Text verschlÃ¼sselt.`
      );
      return;
    }

    if (cipher.supportsKey && key != null) {
      const rawOnlyCiphers = new Set(["rail-fence", "scytale", "columnar-transposition"]);
      let decrypted = cipher.decrypt(text, key);
      let rawText = null;

      if (cipher.id === "playfair" && typeof cipher.decryptRaw === "function") {
        // Playfair liefert die segmentierte Anzeige, aber die UI braucht zusÃ¤tzlich den Rohtext.
        rawText = cipher.decryptRaw(text, key);
      } else if (rawOnlyCiphers.has(cipher.id)) {
        // Rail Fence/Skytale/Columnar geben Rohtext zurÃ¼ck; Segmentierung passiert bewusst im UI-Pfad.
        rawText = decrypted;
        decrypted = segmentRawText(rawText, text, {
          trimTrailingX: cipher.id === "scytale" || cipher.id === "columnar-transposition",
        }).displayText;
      }

      setOutputTexts(decrypted, rawText);
      hideCandidates();
      setStatus(`${cipher.name}: Text entschlÃ¼sselt (SchlÃ¼ssel: ${key}).`);
      return;
    }

    const crackOptions = parseCrackOptions(cipher);
    // Guard vor dem ersten await, damit schnelle Doppelklicks keine parallelen Crack-LÃ¤ufe starten.
    elements.runButton.disabled = true;
    try {
      await enrichCrackOptionsWithKeyCandidates(cipher, text, crackOptions);
      if (
        cipher.id === "vigenere" &&
        !Object.prototype.hasOwnProperty.call(crackOptions, "optimizations")
      ) {
        // Der UI-Pfad nutzt standardmÃ¤ÃŸig den robusteren Optimierungsmodus,
        // damit lange, realistische Texte nicht hinter dem Core-Pfad zurÃ¼ckfallen.
        crackOptions.optimizations = true;
      }
      if (cipher.id === "vigenere") {
        setStatus("VigenÃ¨re: Bruteforce-PrÃ¼fung lÃ¤uft gegebenenfalls, bitte warten ...");
      }

      // Das Rendering muss vor dem CPU-intensiven Crack einmal zurÃ¼ck an den Browser,
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

      const showRawForCipher = new Set(["rail-fence", "scytale", "columnar-transposition", "playfair"]);
      let displayText = bestCandidate.text;
      let rawText = null;

      if (showRawForCipher.has(cipher.id)) {
        rawText =
          bestCandidate.rawText ||
          cracked.rawText ||
          (cracked.candidates && cracked.candidates[0] && cracked.candidates[0].rawText) ||
          null;
        if (rawText) {
          const segmented = segmentRawText(rawText, text, {
            trimTrailingX: cipher.id === "scytale" || cipher.id === "columnar-transposition",
          }).displayText;
          if (cipher.id === "scytale" || cipher.id === "columnar-transposition" || !displayText || displayText === rawText) {
            // Skytale-/Columnar-Padding soll in der segmentierten Anzeige stets entfernt werden.
            displayText = segmented;
          }
        }
      }

      setOutputTexts(displayText, rawText);
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
          ? ` Bruteforce-Fallback aktiv (LÃ¤nge ${fallbackKeyLength == null ? "unbekannt" : fallbackKeyLength}, ${fallbackCombosVisited} Kombinationen, ${fallbackElapsedMs} ms).`
          : "";

      if (bestCandidate.key != null) {
        const suffix = shortVigenereWarning
          ? " Hinweis: Sehr kurzer Text, Ergebnis kann unzuverlÃ¤ssig sein."
          : "";
        setStatus(
          `${cipher.name}: SchlÃ¼ssel geknackt (${bestCandidate.key}), Text entschlÃ¼sselt.${suffix}${fallbackSuffix}`
        );
      } else {
        setStatus(`${cipher.name}: Text automatisch geknackt und entschlÃ¼sselt.${fallbackSuffix}`);
      }
    } finally {
      elements.runButton.disabled = false;
    }
  }

  async function copyOutput(targetText, successMessage) {
    const text = targetText;
    const outputFallback = elements.outputText.value;
    const fallbackToOutput = !text || text === outputFallback;
    const textToCopy = text || outputFallback;
    if (!textToCopy) {
      setStatus("Keine Ausgabe zum Kopieren vorhanden.");
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setStatus(successMessage || "Ausgabe wurde in die Zwischenablage kopiert.");
    } catch (_error) {
      const previousFocus = document.activeElement;
      let success = false;

      if (fallbackToOutput) {
        // Wenn targetText leer/gleich ist, bleibt das Hauptfeld der sicherste Fokusanker fÃ¼r Copy-Fallbacks.
        elements.outputText.focus();
        elements.outputText.select();
        success = document.execCommand("copy");
      } else {
        // targetText muss auch im Fallback kopiert werden, damit Rohtext-Ausgaben korrekt bleiben.
        const tempTextarea = document.createElement("textarea");
        tempTextarea.value = textToCopy;
        tempTextarea.setAttribute("readonly", "true");
        tempTextarea.style.position = "fixed";
        tempTextarea.style.top = "-1000px";
        document.body.appendChild(tempTextarea);
        tempTextarea.focus();
        tempTextarea.select();
        success = document.execCommand("copy");
        tempTextarea.remove();
      }

      if (previousFocus && typeof previousFocus.focus === "function") {
        // Fokus wird wiederhergestellt, damit Tastatur-Workflow nach dem Kopieren stabil bleibt.
        previousFocus.focus();
      }
      setStatus(
        success
          ? successMessage || "Ausgabe wurde in die Zwischenablage kopiert."
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
    elements.copyButton.addEventListener("click", () =>
      copyOutput(elements.outputText.value, "Segmentierte Ausgabe wurde kopiert.")
    );
    elements.rawCopyButton.addEventListener("click", () =>
      copyOutput(elements.rawOutputText.value, "Rohtext wurde kopiert.")
    );
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



