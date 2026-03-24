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
    cipherSelectLabel: document.getElementById("cipherSelectLabelText"),
    cipherSelectWrap: document.getElementById("cipherSelectWrap"),
    cipherSelectButton: document.getElementById("cipherSelectButton"),
    cipherSelectValue: document.getElementById("cipherSelectValue"),
    cipherSelectList: document.getElementById("cipherSelectList"),
    cipherSelectTooltip: document.getElementById("cipherSelectTooltip"),
    keyInputWrap: document.getElementById("keyInputWrap"),
    keyLabel: document.querySelector('label[for="keyInput"]'),
    keyInput: document.getElementById("keyInput"),
    keyHint: document.getElementById("keyHint"),
    rsaKeyWrap: document.getElementById("rsaKeyWrap"),
    rsaKeyLabel: document.getElementById("rsaKeyLabel"),
    rsaPInput: document.getElementById("rsaPInput"),
    rsaQInput: document.getElementById("rsaQInput"),
    rsaNInput: document.getElementById("rsaNInput"),
    rsaEInput: document.getElementById("rsaEInput"),
    rsaDInput: document.getElementById("rsaDInput"),
    rsaKeyHint: document.getElementById("rsaKeyHint"),
    matrixKeyWrap: document.getElementById("matrixKeyWrap"),
    matrixSizeInput: document.getElementById("matrixSizeInput"),
    matrixGrid: document.getElementById("matrixGrid"),
    matrixHint: document.getElementById("matrixHint"),
    alphabetWrap: document.getElementById("alphabetWrap"),
    alphabetInput: document.getElementById("alphabetInput"),
    alphabetHint: document.getElementById("alphabetHint"),
    crackLengthWrap: document.getElementById("crackLengthWrap"),
    crackLengthInput: document.getElementById("crackLengthInput"),
    crackLengthHint: document.getElementById("crackLengthHint"),
    rsaCrackWrap: document.getElementById("rsaCrackWrap"),
    rsaCrackLabel: document.getElementById("rsaCrackLabel"),
    rsaCrackDInput: document.getElementById("rsaCrackDInput"),
    rsaCrackNInput: document.getElementById("rsaCrackNInput"),
    rsaCrackHint: document.getElementById("rsaCrackHint"),
    cipherInfoTitle: document.getElementById("cipherInfoTitle"),
    cipherInfoPurpose: document.getElementById("cipherInfoPurpose"),
    cipherInfoHow: document.getElementById("cipherInfoHow"),
    cipherInfoCrack: document.getElementById("cipherInfoCrack"),
    cipherInfoUse: document.getElementById("cipherInfoUse"),
    cipherInfoNote: document.getElementById("cipherInfoNote"),
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

  const customSelectState = {
    // Status hält UI-Zustand für das Custom-Dropdown, ohne Logik im Cipher-Registry zu duplizieren.
    open: false,
    activeIndex: -1,
    optionEls: [],
    tooltipHold: false,
    tooltipPinned: false,
  };

  function clearCipherSelect() {
    // Reset stellt sicher, dass ein erneutes Populate keine Duplikate hinterlässt.
    elements.cipherSelect.innerHTML = "";
    if (elements.cipherSelectList) {
      elements.cipherSelectList.innerHTML = "";
    }
    customSelectState.optionEls = [];
  }

  function setCustomSelectValueLabel(label) {
    if (!elements.cipherSelectValue) {
      return;
    }
    elements.cipherSelectValue.textContent = label;
  }

  function syncCustomSelectSelection(value) {
    // Auswahl spiegelt den Native-Select-Wert, damit alle bestehenden Logikpfade intakt bleiben.
    const targetValue = value || elements.cipherSelect.value;
    const options = customSelectState.optionEls;
    const selectedIndex = options.findIndex((optionEl) => optionEl.dataset.value === targetValue);
    const safeIndex = selectedIndex >= 0 ? selectedIndex : 0;

    options.forEach((optionEl, index) => {
      optionEl.setAttribute("aria-selected", index === safeIndex ? "true" : "false");
    });

    const selectedOption = options[safeIndex];
    if (selectedOption) {
      setCustomSelectValueLabel(selectedOption.dataset.label || selectedOption.textContent);
      customSelectState.activeIndex = safeIndex;
    }
  }

  function positionCipherTooltip(optionEl) {
    if (!elements.cipherSelectTooltip || !elements.cipherSelectWrap) {
      return;
    }
    const wrapRect = elements.cipherSelectWrap.getBoundingClientRect();
    const optionRect = optionEl.getBoundingClientRect();
    const topOffset = Math.max(0, Math.round(optionRect.top - wrapRect.top));
    elements.cipherSelectTooltip.style.top = `${topOffset}px`;
  }

  function showCipherTooltip(optionEl, pin) {
    // Tooltip erscheint nur, wenn das Dropdown offen ist und die Option eine Notiz trägt.
    if (!customSelectState.open || !elements.cipherSelectTooltip) {
      return;
    }
    const note = optionEl.dataset.tooltip;
    if (!note) {
      return;
    }
    elements.cipherSelectTooltip.textContent = note;
    elements.cipherSelectTooltip.hidden = false;
    customSelectState.tooltipPinned = Boolean(pin);
    positionCipherTooltip(optionEl);
  }

  function hideCipherTooltip(force) {
    if (!elements.cipherSelectTooltip) {
      return;
    }
    if (!force && (customSelectState.tooltipPinned || customSelectState.tooltipHold)) {
      return;
    }
    elements.cipherSelectTooltip.hidden = true;
    elements.cipherSelectTooltip.textContent = "";
    elements.cipherSelectTooltip.style.top = "";
    customSelectState.tooltipPinned = false;
  }

  function closeCipherSelect(restoreFocus) {
    if (!elements.cipherSelectWrap || !elements.cipherSelectButton) {
      return;
    }
    elements.cipherSelectWrap.dataset.open = "false";
    elements.cipherSelectButton.setAttribute("aria-expanded", "false");
    if (elements.cipherSelectList) {
      // Screenreader sollen den geschlossenen Zustand klar erkennen.
      elements.cipherSelectList.setAttribute("aria-hidden", "true");
    }
    customSelectState.open = false;
    hideCipherTooltip(true);
    if (restoreFocus) {
      elements.cipherSelectButton.focus();
    }
  }

  function focusCipherOption(index) {
    const options = customSelectState.optionEls;
    if (!options.length) {
      return;
    }
    const safeIndex = Math.max(0, Math.min(index, options.length - 1));
    const optionEl = options[safeIndex];
    if (!optionEl) {
      return;
    }
    optionEl.focus();
    customSelectState.activeIndex = safeIndex;
  }

  function openCipherSelect() {
    if (!elements.cipherSelectWrap || !elements.cipherSelectButton) {
      return;
    }
    elements.cipherSelectWrap.dataset.open = "true";
    elements.cipherSelectButton.setAttribute("aria-expanded", "true");
    if (elements.cipherSelectList) {
      // Liste wird zugänglich, sobald das Dropdown geöffnet ist.
      elements.cipherSelectList.setAttribute("aria-hidden", "false");
    }
    customSelectState.open = true;
    const selectedIndex = customSelectState.optionEls.findIndex(
      (optionEl) => optionEl.dataset.value === elements.cipherSelect.value
    );
    focusCipherOption(selectedIndex >= 0 ? selectedIndex : 0);
  }

  function selectCipherValue(value) {
    // Auswahl setzt den Native-Select-Wert und triggert die bestehende Change-Logik.
    if (!value) {
      return;
    }
    elements.cipherSelect.value = value;
    syncCustomSelectSelection(value);
    elements.cipherSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function buildCustomCipherOption(cipher, index) {
    const optionEl = document.createElement("li");
    optionEl.className = "custom-select-option";
    optionEl.setAttribute("role", "option");
    optionEl.setAttribute("tabindex", "-1");
    optionEl.dataset.value = cipher.id;
    optionEl.dataset.label = cipher.name;
    optionEl.dataset.index = String(index);
    optionEl.id = `cipher-option-${cipher.id}`;
    optionEl.textContent = cipher.name;

    if (cipher.info && cipher.info.note) {
      // Der Info-Hinweis wird als „ⓘ“ markiert, damit Hover den Tooltip erklärt.
      const icon = document.createElement("span");
      icon.className = "custom-select-option-icon";
      icon.textContent = "ⓘ";
      optionEl.dataset.tooltip = cipher.info.note;
      optionEl.appendChild(icon);
    }

    optionEl.addEventListener("click", () => {
      selectCipherValue(cipher.id);
      closeCipherSelect(true);
    });

    optionEl.addEventListener("mouseenter", () => {
      showCipherTooltip(optionEl, false);
    });

    optionEl.addEventListener("mouseleave", () => {
      hideCipherTooltip(false);
    });

    optionEl.addEventListener("focus", () => {
      customSelectState.activeIndex = Number(optionEl.dataset.index) || 0;
      showCipherTooltip(optionEl, true);
    });

    optionEl.addEventListener("blur", () => {
      customSelectState.tooltipPinned = false;
      hideCipherTooltip(false);
    });

    return optionEl;
  }

  function populateCipherSelect() {
    clearCipherSelect();
    for (const cipher of registry.list()) {
      const option = document.createElement("option");
      option.value = cipher.id;
      option.textContent = cipher.name;
      elements.cipherSelect.append(option);

      if (elements.cipherSelectList) {
        const customOption = buildCustomCipherOption(cipher, customSelectState.optionEls.length);
        elements.cipherSelectList.append(customOption);
        customSelectState.optionEls.push(customOption);
      }
    }
    if (!elements.cipherSelect.value && customSelectState.optionEls.length > 0) {
      elements.cipherSelect.value = customSelectState.optionEls[0].dataset.value;
    }
    syncCustomSelectSelection(elements.cipherSelect.value);
  }

  function refreshKeyUI() {
    const mode = elements.modeSelect.value;
    const cipher = getSelectedCipher();

    if (!cipher) {
      if (elements.keyInputWrap) {
        // Fallback-UI bleibt sichtbar, falls kein Cipher geladen wurde.
        elements.keyInputWrap.hidden = false;
      }
      if (elements.matrixKeyWrap) {
        elements.matrixKeyWrap.hidden = true;
      }
      if (elements.rsaKeyWrap) {
        // RSA-Felder sollen ohne Cipher-Auswahl nicht sichtbar sein.
        elements.rsaKeyWrap.hidden = true;
      }
      return;
    }

    const supportsMatrixKey = cipher.supportsMatrixKey === true;
    const supportsRsaParams = cipher.supportsRsaParams === true;
    const supportsKey = Boolean(cipher.supportsKey);
    // UI-Texte werden als echte UTF-8-Zeichen gepflegt, damit Umlaute korrekt angezeigt werden.
    const label = cipher.keyLabel || "Schlüssel";
    const placeholder = cipher.keyPlaceholder || "z. B. 3";

    if (elements.keyInputWrap) {
      // Matrix- und RSA-Inputs haben eigene Felder, damit das Standard-Key-Input nicht irrtümlich befüllt wird.
      elements.keyInputWrap.hidden = supportsMatrixKey || supportsRsaParams;
    }

    if (elements.rsaKeyWrap) {
      // RSA-Felder bleiben nur für RSA sichtbar, damit die UI übersichtlich bleibt.
      elements.rsaKeyWrap.hidden = !supportsRsaParams;
    }

    if (elements.matrixKeyWrap) {
      // Matrix-Input bleibt nur bei passenden Ciphers sichtbar, damit die UI schlank bleibt.
      elements.matrixKeyWrap.hidden = !supportsMatrixKey;
    }

    const suffix = mode === "encrypt" ? " (erforderlich)" : " (optional)";
    elements.keyLabel.textContent = supportsKey ? `${label}${suffix}` : "Schlüssel";
    elements.keyInput.placeholder = placeholder;
    elements.keyInput.disabled = !supportsKey;

    if (supportsRsaParams && elements.rsaKeyLabel) {
      // RSA-Nutzung folgt dem selben Required/Optional-Hinweis wie das Standardfeld.
      elements.rsaKeyLabel.textContent = supportsKey ? `${label}${suffix}` : label;
    }

    if (supportsMatrixKey && elements.matrixHint) {
      elements.matrixHint.textContent =
        mode === "encrypt"
          ? "Matrix vollständig ausfüllen; Werte werden modulo 26 ausgewertet."
          : "Matrix leer lassen, um 2×2 zu knacken. Werte werden modulo 26 ausgewertet.";
    }

    if (supportsMatrixKey) {
      // Grid wird beim Wechsel auf Hill dynamisch gerendert, damit die Größe sofort sichtbar ist.
      safeRenderMatrixGrid();
    }

    if (!supportsKey) {
      elements.keyInput.value = "";
      elements.keyHint.textContent =
        "Dieses Verfahren nutzt keinen Schlüssel. Beim Entschlüsseln wird automatisch geknackt.";
      if (supportsRsaParams && elements.rsaKeyHint) {
        elements.rsaKeyHint.textContent =
          "Dieses Verfahren nutzt keinen Schlüssel. Beim Entschlüsseln wird automatisch geknackt.";
      }
      return;
    }

    if (mode === "decrypt") {
      // Der Hinweis muss generisch bleiben, da mehrere Verfahren das Key-Feld fürs Knacken wiederverwenden.
      elements.keyHint.textContent = cipher.reuseKeyForCrackHint
        ? `Leer lassen, um ${label.toLowerCase()} automatisch zu knacken. Mit Zahl wird direkt entschlüsselt.`
        : "Leer lassen, um den Schlüssel automatisch zu knacken.";
      if (supportsRsaParams && elements.rsaKeyHint) {
        elements.rsaKeyHint.textContent =
          "Für Decrypt: n und d. p,q optional zur Ableitung. Leer lassen, um per d,n zu knacken.";
      }
    } else {
      elements.keyHint.textContent = "Beim Verschlüsseln ist ein Schlüssel erforderlich.";
      if (supportsRsaParams && elements.rsaKeyHint) {
        elements.rsaKeyHint.textContent = "Für Encrypt: n und e. p,q optional zur Ableitung.";
      }
    }

    if (!supportsRsaParams) {
      clearRsaKeyInputs();
    } else if (elements.keyInput) {
      // RSA nutzt eigene Felder, daher Standard-Key-Feld leeren.
      elements.keyInput.value = "";
    }
  }

  function readRsaFieldValue(inputEl) {
    const raw = String((inputEl && inputEl.value) || "").trim();
    // Leerwerte bleiben null, damit wir nicht irrtümlich Teil-Schlüssel erzeugen.
    return raw === "" ? null : raw;
  }

  function collectRsaKeyFields() {
    return {
      p: readRsaFieldValue(elements.rsaPInput),
      q: readRsaFieldValue(elements.rsaQInput),
      n: readRsaFieldValue(elements.rsaNInput),
      e: readRsaFieldValue(elements.rsaEInput),
      d: readRsaFieldValue(elements.rsaDInput),
    };
  }

  function hasRsaKeyInput() {
    const fields = collectRsaKeyFields();
    // Sichtbare Werte entscheiden, ob ein RSA-Schluessel vorliegt.
    return Object.values(fields).some((value) => value != null);
  }

  function clearRsaKeyInputs() {
    // Beim Cipher-Wechsel sollen keine RSA-Reste in andere Verfahren hineinragen.
    [elements.rsaPInput, elements.rsaQInput, elements.rsaNInput, elements.rsaEInput, elements.rsaDInput]
      .filter(Boolean)
      .forEach((input) => {
        input.value = "";
      });
  }

  function clearRsaCrackInputs() {
    // Crack-Hints bleiben nur fuer RSA sichtbar, daher hier defensiv loeschen.
    [elements.rsaCrackDInput, elements.rsaCrackNInput].filter(Boolean).forEach((input) => {
      input.value = "";
    });
  }

  function readMatrixSize() {
    if (!elements.matrixSizeInput) {
      return 2;
    }

    const raw = String(elements.matrixSizeInput.value || "").trim();
    const size = Number.parseInt(raw, 10);
    if (!Number.isFinite(size) || size < 2) {
      throw new Error("Matrixgröße muss eine ganze Zahl ab 2 sein.");
    }

    return size;
  }

  function renderMatrixGrid(size) {
    if (!elements.matrixGrid) {
      return;
    }

    const existing = new Map();
    const inputs = elements.matrixGrid.querySelectorAll("input");
    for (const input of inputs) {
      const row = Number.parseInt(input.dataset.row, 10);
      const col = Number.parseInt(input.dataset.col, 10);
      if (!Number.isNaN(row) && !Number.isNaN(col)) {
        existing.set(`${row},${col}`, input.value);
      }
    }

    elements.matrixGrid.innerHTML = "";
    elements.matrixGrid.style.setProperty("--matrix-size", size);

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const input = document.createElement("input");
        input.type = "number";
        input.step = "1";
        input.inputMode = "numeric";
        input.className = "matrix-cell";
        input.placeholder = "0";
        input.dataset.row = String(row);
        input.dataset.col = String(col);
        input.setAttribute("aria-label", `Matrix ${row + 1},${col + 1}`);
        // Die Eingaben bleiben beim Resize erhalten, damit Nutzer nicht neu tippen müssen.
        input.value = existing.get(`${row},${col}`) || "";
        elements.matrixGrid.appendChild(input);
      }
    }
  }

  function safeRenderMatrixGrid() {
    if (!elements.matrixKeyWrap || elements.matrixKeyWrap.hidden) {
      return;
    }

    try {
      const size = readMatrixSize();
      renderMatrixGrid(size);
    } catch (_error) {
      // Ungültige Größen sollen die UI nicht blockieren; Validierung passiert beim Ausführen.
    }
  }

  function readMatrixKey() {
    if (!elements.matrixGrid || !elements.matrixSizeInput) {
      return null;
    }

    const size = readMatrixSize();
    const matrix = Array.from({ length: size }, () => Array(size).fill(null));
    const inputs = elements.matrixGrid.querySelectorAll("input");
    let hasValue = false;
    let hasMissing = false;

    for (const input of inputs) {
      const raw = String(input.value || "").trim();
      const row = Number.parseInt(input.dataset.row, 10);
      const col = Number.parseInt(input.dataset.col, 10);
      if (Number.isNaN(row) || Number.isNaN(col)) {
        continue;
      }

      if (raw === "") {
        hasMissing = true;
        continue;
      }

      const value = Number(raw);
      if (!Number.isFinite(value) || !Number.isInteger(value)) {
        throw new Error("Matrixeinträge müssen ganze Zahlen sein.");
      }

      hasValue = true;
      matrix[row][col] = value;
    }

    if (!hasValue) {
      return null;
    }

    if (hasMissing || matrix.some((row) => row.some((value) => value == null))) {
      throw new Error("Matrix ist unvollständig ausgefüllt.");
    }

    return { matrix, size };
  }

  function refreshCrackLengthUI() {
    const mode = elements.modeSelect.value;
    const cipher = getSelectedCipher();
    const supportsRsaParams = Boolean(cipher && cipher.supportsRsaParams);
    const hasManualKey = supportsRsaParams ? hasRsaKeyInput() : elements.keyInput.value.trim() !== "";

    if (cipher && cipher.supportsMatrixKey === true) {
      // Matrix-Verfahren nutzen ein eigenes Größenfeld, damit kein zweites Hint-Feld erscheint.
      elements.crackLengthWrap.hidden = true;
      elements.crackLengthInput.disabled = true;
      return;
    }

    const show =
      Boolean(cipher && cipher.supportsCrackLengthHint) &&
      !Boolean(cipher && cipher.reuseKeyForCrackHint) &&
      mode === "decrypt" &&
      !hasManualKey;

    if (
      supportsRsaParams &&
      elements.rsaCrackWrap &&
      elements.rsaCrackDInput &&
      elements.rsaCrackNInput
    ) {
      // RSA nutzt eigene d/n-Felder, damit keine Verwechslungsgefahr mit Laengen-Hints besteht.
      elements.rsaCrackWrap.hidden = !show;
      elements.rsaCrackDInput.disabled = !show;
      elements.rsaCrackNInput.disabled = !show;
      elements.crackLengthWrap.hidden = true;
      elements.crackLengthInput.disabled = true;
    } else {
      elements.crackLengthWrap.hidden = !show;
      elements.crackLengthInput.disabled = !show;
      if (elements.rsaCrackWrap) {
        elements.rsaCrackWrap.hidden = true;
      }
    }

    if (!show) {
      // Versteckte Altwerte dürfen keine unbeabsichtigten Hints in Verfahren einspeisen,
      // die das Schlüssel-Feld selbst schon als Crack-/Decrypt-Schalter verwenden.
      if (cipher && cipher.reuseKeyForCrackHint) {
        elements.crackLengthInput.value = "";
      }
      clearRsaCrackInputs();
      return;
    }

    const label = cipher.crackLengthLabel || "Schlüssellänge";
    const hintRequired = Boolean(cipher.crackHintRequired);
    const placeholder = cipher.crackLengthPlaceholder || "z. B. 6";

    if (supportsRsaParams && elements.rsaCrackLabel && elements.rsaCrackHint) {
      elements.rsaCrackLabel.textContent = `${label} fürs Knacken (erforderlich)`;
      elements.rsaCrackHint.textContent = "d und n sind erforderlich.";
      return;
    }

    elements.crackLengthWrap
      .querySelector('label[for="crackLengthInput"]')
      // RSA-Mini benoetigt d,n zwingend; der Hinweis soll das klar signalisieren.
      .textContent = `${label} fürs Knacken${hintRequired ? " (erforderlich)" : " (optional)"}`;
    elements.crackLengthInput.placeholder = placeholder;
    elements.crackLengthHint.textContent = hintRequired
      ? "Für RSA Mini ist der Hinweis zwingend erforderlich."
      : "Wenn bekannt, beschleunigt und verbessert das Knacken.";
  }

  function refreshAlphabetUI() {
    const cipher = getSelectedCipher();

    if (!cipher) {
      return;
    }

    const show = Boolean(cipher.supportsAlphabet);
    elements.alphabetWrap.hidden = !show;
    elements.alphabetInput.disabled = !show;

    if (!show) {
      return;
    }

    const label = cipher.alphabetLabel || "Alphabet";
    const placeholder = cipher.alphabetPlaceholder || cipher.defaultAlphabet || "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    elements.alphabetWrap.querySelector('label[for="alphabetInput"]').textContent = label;
    elements.alphabetInput.placeholder = placeholder;
    elements.alphabetHint.textContent = "Alphabet bestimmt Modulo m = Länge.";

    if (!elements.alphabetInput.value.trim()) {
      // Default bleibt vorbefüllt, damit der Modulo-Kontext direkt sichtbar ist.
      elements.alphabetInput.value = cipher.defaultAlphabet || "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    }
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
    if (elements.cipherInfoNote) {
      // Hinweis ist optional und soll die Box nicht aufblasen, wenn kein Zusatztext vorhanden ist.
      const note = info.note || "";
      elements.cipherInfoNote.textContent = note ? `Hinweis: ${note}` : "";
      elements.cipherInfoNote.hidden = !note;
    }
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

  function applyUndBridgeFallback(rawText, displayText) {
    const raw = String(rawText || "");
    if (!raw.includes("UND")) {
      return displayText;
    }
    if (displayText && displayText.includes(" UND ")) {
      return displayText;
    }

    // Zahlen-Cäsar liefert reine Buchstabenketten; ein gezielter UND-Split erhöht die Lesbarkeit,
    // ohne kurze Wörter wie HUND/GRUND unabsichtlich zu zerlegen.
    const forced = raw.replace(/([A-Z]{3,})UND([A-Z]{3,})/g, "$1 UND $2");
    return forced === raw ? displayText : forced;
  }

  function segmentRawText(rawText, sourceText, options) {
    const opts = options && typeof options === "object" ? options : {};
    const trimmedRaw =
      opts.trimTrailingX === true ? String(rawText || "").replace(/X+$/g, "") : rawText;
    const scorer = core.dictionaryScorer;
    if (!scorer || typeof scorer.analyzeTextQuality !== "function") {
      return {
        displayText:
          opts.forceUndSplit === true
            ? applyUndBridgeFallback(trimmedRaw, trimmedRaw)
            : trimmedRaw,
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
        displayText:
          opts.forceUndSplit === true
            ? applyUndBridgeFallback(trimmedRaw, displayText || trimmedRaw)
            : displayText || trimmedRaw,
        rawText: rawText,
      };
    } catch (_error) {
      // Segmentierungsfehler sollen die Roh-Ausgabe nie blockieren.
      return {
        displayText:
          opts.forceUndSplit === true
            ? applyUndBridgeFallback(trimmedRaw, trimmedRaw)
            : trimmedRaw,
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

  function getCipherAlphabet(cipher) {
    if (!cipher || !cipher.supportsAlphabet) {
      return null;
    }

    const rawAlphabet = elements.alphabetInput.value;
    const fallback = cipher.defaultAlphabet || "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const chosen = rawAlphabet.trim() === "" ? fallback : rawAlphabet;

    if (typeof cipher.normalizeAlphabet === "function") {
      // Cipher-spezifische Regeln (z. B. Case-Insensitivity) müssen zentral angewendet werden.
      return cipher.normalizeAlphabet(chosen);
    }

    return String(chosen || fallback).replace(/[\r\n]/g, "");
  }

  function isCustomAlphabet(cipher, alphabet) {
    if (!cipher || !cipher.supportsAlphabet) {
      return false;
    }

    const fallback = cipher.defaultAlphabet || "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const normalizedDefault =
      typeof cipher.normalizeAlphabet === "function"
        ? cipher.normalizeAlphabet(fallback)
        : String(fallback || "").replace(/[\r\n]/g, "");

    return String(alphabet) !== String(normalizedDefault);
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
      // verbessern nur den Suchraum für Phase B und ändern den UI-Fluss nicht.
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
      // Optionales Enrichment darf den regulären Crack-Lauf nie blockieren.
    }

    return crackOptions;
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

  function parseOptionalKey(cipher, alphabet) {
    if (!cipher.supportsKey) {
      return null;
    }

    if (cipher.supportsMatrixKey === true) {
      const rawMatrix = readMatrixKey();
      if (rawMatrix == null) {
        return null;
      }
      return typeof cipher.parseKey === "function" ? cipher.parseKey(rawMatrix) : rawMatrix;
    }

    if (cipher.supportsRsaParams === true) {
      const rawFields = collectRsaKeyFields();
      if (!hasRsaKeyInput()) {
        return null;
      }
      // RSA-Parameter werden als Objekt weitergereicht, damit parseKey sauber validiert.
      return typeof cipher.parseKey === "function" ? cipher.parseKey(rawFields) : rawFields;
    }

    const raw = elements.keyInput.value.trim();
    if (raw === "") {
      return null;
    }

    if (typeof cipher.parseKey === "function") {
      return cipher.supportsAlphabet ? cipher.parseKey(raw, { alphabet }) : cipher.parseKey(raw);
    }

    return raw;
  }

  function parseCrackOptions(cipher, alphabet) {
    const options = {};

    if (cipher.supportsAlphabet) {
      options.alphabet = alphabet;
    }

    if (cipher.supportsMatrixKey === true) {
      options.matrixSize = readMatrixSize();
      return options;
    }

    if (cipher.supportsRsaParams === true) {
      const dRaw = readRsaFieldValue(elements.rsaCrackDInput);
      const nRaw = readRsaFieldValue(elements.rsaCrackNInput);

      if (dRaw == null && nRaw == null) {
        return options;
      }

      if (dRaw == null || nRaw == null) {
        // RSA-Crack benoetigt beide Parameter, sonst ist die Entschluesselung nicht definiert.
        throw new Error("Für RSA Mini müssen d und n angegeben werden.");
      }

      if (typeof cipher.parseCrackHint === "function") {
        Object.assign(options, cipher.parseCrackHint(`d=${dRaw}, n=${nRaw}`));
        return options;
      }

      options.d = dRaw;
      options.n = nRaw;
      return options;
    }

    if (!cipher.supportsCrackLengthHint || cipher.reuseKeyForCrackHint) {
      return options;
    }

    const rawLength = elements.crackLengthInput.value.trim();
    if (rawLength === "") {
      return options;
    }

    if (typeof cipher.parseCrackHint === "function") {
      // Cipher-spezifische Crack-Hints halten die UI-Logik schlank und verhindern Mehrdeutigkeiten.
      const parsedHint = cipher.parseCrackHint(rawLength);
      if (parsedHint && typeof parsedHint === "object") {
        Object.assign(options, parsedHint);
      }
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

    const alphabet = getCipherAlphabet(cipher);
    // Hinweis wird zentral vorbereitet, damit Encrypt/Decrypt/Crack konsistent warnen.
    const customAlphabetWarning = isCustomAlphabet(cipher, alphabet)
      ? " Hinweis: Benutzerdefiniertes Alphabet – Sprach-Scoring kann unzuverlässig sein."
      : "";
    const key = parseOptionalKey(cipher, alphabet);

    if (mode === "encrypt") {
      if (cipher.supportsKey && key == null) {
        throw new Error("Beim Verschlüsseln wird ein Schlüssel benötigt.");
      }

      const encrypted = cipher.encrypt(text, key);
      if (cipher.id === "xor") {
        // XOR zeigt HEX als Hauptausgabe und den Klartext separat, damit Byte-Output lesbar bleibt.
        setOutputTexts(encrypted, text);
      } else {
        setOutputTexts(encrypted, null);
      }
      hideCandidates();
      setStatus(
        cipher.supportsKey
          ? `${cipher.name}: Text verschlüsselt (Schlüssel: ${key}).${customAlphabetWarning}`
          : `${cipher.name}: Text verschlüsselt.${customAlphabetWarning}`
      );
      return;
    }

    if (cipher.supportsKey && key != null) {
      const rawOnlyCiphers = new Set([
        "rail-fence",
        "scytale",
        "columnar-transposition",
        // Positionscipher bleibt im UI segmentiert, damit Block-Padding nachvollziehbar bleibt.
        "position-cipher",
        "hill",
        // Zahlen-Cäsar liefert Rohtext ohne Leerzeichen; Segmentierung bleibt im UI-Pfad.
        "number-caesar",
      ]);
      let decrypted = cipher.decrypt(text, key);
      let rawText = null;

      if (cipher.id === "xor") {
        // XOR braucht die normalisierte HEX-Rohdarstellung, ohne Segmentierung im UI.
        rawText =
          typeof cipher.normalizeHexInput === "function"
            ? cipher.normalizeHexInput(text)
            : String(text || "").replace(/\s+/g, "").toUpperCase();
      } else if (cipher.id === "playfair" && typeof cipher.decryptRaw === "function") {
        // Playfair liefert die segmentierte Anzeige, aber die UI braucht zusätzlich den Rohtext.
        rawText = cipher.decryptRaw(text, key);
      } else if (rawOnlyCiphers.has(cipher.id)) {
        // Rail Fence/Skytale/Columnar/Hill geben Rohtext zurück; Segmentierung passiert bewusst im UI-Pfad.
        rawText = decrypted;
        decrypted = segmentRawText(rawText, text, {
          trimTrailingX:
            cipher.id === "scytale" ||
            cipher.id === "columnar-transposition" ||
            cipher.id === "position-cipher" ||
            cipher.id === "hill",
          forceUndSplit: cipher.id === "number-caesar",
        }).displayText;
      }

      setOutputTexts(decrypted, rawText);
      hideCandidates();
      setStatus(`${cipher.name}: Text entschlüsselt (Schlüssel: ${key}).${customAlphabetWarning}`);
      return;
    }

    const crackOptions = parseCrackOptions(cipher, alphabet);
    // Guard vor dem ersten await, damit schnelle Doppelklicks keine parallelen Crack-Läufe starten.
    elements.runButton.disabled = true;
    try {
      await enrichCrackOptionsWithKeyCandidates(cipher, text, crackOptions);
      if (
        cipher.id === "vigenere" &&
        !Object.prototype.hasOwnProperty.call(crackOptions, "optimizations")
      ) {
        // Der UI-Pfad nutzt standardmäßig den robusteren Optimierungsmodus,
        // damit lange, realistische Texte nicht hinter dem Core-Pfad zurückfallen.
        crackOptions.optimizations = true;
      }
      if (cipher.id === "vigenere") {
        setStatus("Vigenère: Bruteforce-Prüfung läuft gegebenenfalls, bitte warten ...");
      }

      // Das Rendering muss vor dem CPU-intensiven Crack einmal zurück an den Browser,
      // damit der Wartehinweis sichtbar ist, bevor die Hauptschleife blockiert.
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const cracked = cipher.crack(text, crackOptions);

      // WIP-Status signalisiert, dass Knacken nicht vollständig implementiert ist:
      // UI zeigt nur die Statusmeldung, ohne Kandidaten oder implizierte Erfolge zu rendern.
      if (cracked && cracked.search && cracked.search.wip === true) {
        hideCandidates();
        setOutputTexts("", null);
        setStatus(
          cracked.search.wipMessage ||
          `${cipher.name}: Entschlüsselung ist Work in Progress.${customAlphabetWarning}`
        );
        return;
      }

      const localCandidates = normalizeCrackCandidates(cracked);
      const ranked = await rankCandidatesWithDictionary(localCandidates, text);
      const rankedCandidates =
        ranked.rankedCandidates && ranked.rankedCandidates.length > 0
          ? ranked.rankedCandidates
          : localCandidates;
      const bestCandidate =
        ranked.bestCandidate || rankedCandidates[0] || cracked;

      const showRawForCipher = new Set([
        "rail-fence",
        "scytale",
        "columnar-transposition",
        // Positionscipher zeigt Rohtext separat, damit Block-Padding sichtbar bleibt.
        "position-cipher",
        "playfair",
        "hill",
        // Zahlen-Cäsar zeigt Rohtext separat, damit die Segmentierung nachvollziehbar bleibt.
        "number-caesar",
      ]);
      let displayText = bestCandidate.text;
      let rawText = null;

      if (cipher.id === "xor") {
        // XOR zeigt immer Klartext + HEX, ohne Segmentierung des Byte-Outputs.
        rawText =
          bestCandidate.rawText ||
          cracked.rawText ||
          (cracked.candidates && cracked.candidates[0] && cracked.candidates[0].rawText) ||
          null;
      } else if (showRawForCipher.has(cipher.id)) {
        rawText =
          bestCandidate.rawText ||
          cracked.rawText ||
          (cracked.candidates && cracked.candidates[0] && cracked.candidates[0].rawText) ||
          null;
        if (rawText) {
          const segmented = segmentRawText(rawText, text, {
            trimTrailingX:
              cipher.id === "scytale" ||
              cipher.id === "columnar-transposition" ||
              cipher.id === "position-cipher" ||
              cipher.id === "hill",
            forceUndSplit: cipher.id === "number-caesar",
          }).displayText;
          if (
            cipher.id === "scytale" ||
            cipher.id === "columnar-transposition" ||
            cipher.id === "position-cipher" ||
            cipher.id === "hill" ||
            !displayText ||
            displayText === rawText
          ) {
            // Skytale-/Columnar-/Hill-Padding soll in der segmentierten Anzeige stets entfernt werden.
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
          ? ` Bruteforce-Fallback aktiv (Länge ${fallbackKeyLength == null ? "unbekannt" : fallbackKeyLength}, ${fallbackCombosVisited} Kombinationen, ${fallbackElapsedMs} ms).`
          : "";

      if (bestCandidate.key != null) {
        const suffix = shortVigenereWarning
          ? " Hinweis: Sehr kurzer Text, Ergebnis kann unzuverlässig sein."
          : "";
        setStatus(
          `${cipher.name}: Schlüssel geknackt (${bestCandidate.key}), Text entschlüsselt.${suffix}${fallbackSuffix}${customAlphabetWarning}`
        );
      } else {
        setStatus(
          `${cipher.name}: Text automatisch geknackt und entschlüsselt.${fallbackSuffix}${customAlphabetWarning}`
        );
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
        // Wenn targetText leer/gleich ist, bleibt das Hauptfeld der sicherste Fokusanker für Copy-Fallbacks.
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

    if (elements.cipherSelectButton && elements.cipherSelectWrap) {
      if (elements.cipherSelectLabel) {
        elements.cipherSelectLabel.addEventListener("click", (event) => {
          // Label-Klick soll das Custom-Dropdown öffnen, nicht das versteckte Select fokussieren.
          event.preventDefault();
          if (!customSelectState.open) {
            openCipherSelect();
          }
        });
      }

      elements.cipherSelectButton.addEventListener("click", (event) => {
        // Button toggelt Dropdown und verhindert ungewollte Formularfokusseffekte.
        event.preventDefault();
        if (customSelectState.open) {
          closeCipherSelect(false);
        } else {
          openCipherSelect();
        }
      });

      elements.cipherSelectButton.addEventListener("keydown", (event) => {
        // Tastaturzugriff erlaubt Öffnen und erstes Navigieren ohne Maus.
        if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === " " || event.key === "Enter") {
          event.preventDefault();
          if (!customSelectState.open) {
            openCipherSelect();
          } else {
            focusCipherOption(customSelectState.activeIndex >= 0 ? customSelectState.activeIndex : 0);
          }
        }
      });

      elements.cipherSelectWrap.addEventListener("keydown", (event) => {
        // Listbox-Navigation bleibt konsistent, egal ob Fokus auf Option oder Liste liegt.
        if (!customSelectState.open) {
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          focusCipherOption(customSelectState.activeIndex + 1);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          focusCipherOption(customSelectState.activeIndex - 1);
          return;
        }
        if (event.key === "Home") {
          event.preventDefault();
          focusCipherOption(0);
          return;
        }
        if (event.key === "End") {
          event.preventDefault();
          focusCipherOption(customSelectState.optionEls.length - 1);
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          const optionEl = customSelectState.optionEls[customSelectState.activeIndex];
          if (optionEl) {
            selectCipherValue(optionEl.dataset.value);
          }
          closeCipherSelect(true);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          closeCipherSelect(true);
        }
      });

      document.addEventListener("click", (event) => {
        // Klicks außerhalb des Wrappers schließen das Dropdown, damit es nicht hängen bleibt.
        if (!customSelectState.open) {
          return;
        }
        if (!elements.cipherSelectWrap.contains(event.target)) {
          closeCipherSelect(false);
        }
      });
    }

    if (elements.cipherSelectTooltip) {
      elements.cipherSelectTooltip.addEventListener("mouseenter", () => {
        // Tooltip darf beim Lesen nicht sofort verschwinden.
        customSelectState.tooltipHold = true;
      });
      elements.cipherSelectTooltip.addEventListener("mouseleave", () => {
        customSelectState.tooltipHold = false;
        hideCipherTooltip(false);
      });
    }

    elements.modeSelect.addEventListener("change", refreshKeyUI);
    elements.modeSelect.addEventListener("change", refreshCrackLengthUI);
    elements.keyInput.addEventListener("input", refreshCrackLengthUI);
    [
      elements.rsaPInput,
      elements.rsaQInput,
      elements.rsaNInput,
      elements.rsaEInput,
      elements.rsaDInput,
      elements.rsaCrackDInput,
      elements.rsaCrackNInput,
    ]
      .filter(Boolean)
      .forEach((input) => {
        // RSA-Felder beeinflussen, ob Crack-Hints sichtbar bleiben.
        input.addEventListener("input", refreshCrackLengthUI);
      });
    if (elements.matrixSizeInput) {
      elements.matrixSizeInput.addEventListener("input", safeRenderMatrixGrid);
      elements.matrixSizeInput.addEventListener("change", safeRenderMatrixGrid);
    }
    elements.cipherSelect.addEventListener("change", () => {
      // Native-Select bleibt Source of Truth; Custom-UI wird nur synchronisiert.
      syncCustomSelectSelection(elements.cipherSelect.value);
      refreshKeyUI();
      refreshCrackLengthUI();
      refreshAlphabetUI();
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
    if (elements.cipherSelectWrap) {
      // Default-Zustand bleibt geschlossen, damit keine Liste initial sichtbar ist.
      elements.cipherSelectWrap.dataset.open = "false";
    }
    if (elements.cipherSelectList) {
      // Geschlossene Liste soll für Screenreader verborgen bleiben.
      elements.cipherSelectList.setAttribute("aria-hidden", "true");
    }
    wireEvents();
    setupDragAndDrop();
    refreshKeyUI();
    refreshCrackLengthUI();
    refreshAlphabetUI();
    refreshCipherInfo();
    safeRenderMatrixGrid();
  }

  init();
})(window);



