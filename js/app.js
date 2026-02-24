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
    cipherInfoTitle: document.getElementById("cipherInfoTitle"),
    cipherInfoPurpose: document.getElementById("cipherInfoPurpose"),
    cipherInfoHow: document.getElementById("cipherInfoHow"),
    cipherInfoCrack: document.getElementById("cipherInfoCrack"),
    cipherInfoUse: document.getElementById("cipherInfoUse"),
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

  function runCipher() {
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
      setStatus(`${cipher.name}: Text entschlüsselt (Schlüssel: ${key}).`);
      return;
    }

    const cracked = cipher.crack(text);
    elements.outputText.value = cracked.text;

    if (cracked.key != null) {
      setStatus(
        `${cipher.name}: Schlüssel geknackt (${cracked.key}), Text entschlüsselt.`
      );
    } else {
      setStatus(`${cipher.name}: Text automatisch geknackt und entschlüsselt.`);
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
    elements.cipherSelect.addEventListener("change", () => {
      refreshKeyUI();
      refreshCipherInfo();
    });
    elements.runButton.addEventListener("click", () => {
      try {
        runCipher();
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
    refreshCipherInfo();
  }

  init();
})(window);
