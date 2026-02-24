(function initApp(global) {
  const core = global.KryptoCore || {};
  const ciphers = global.KryptoCiphers || {};

  if (!core.CipherRegistry || !core.parseInputFile || !ciphers.caesarCipher) {
    throw new Error("App-Komponenten wurden nicht korrekt geladen.");
  }

  const registry = new core.CipherRegistry();
  registry.register(ciphers.caesarCipher);

  const elements = {
    dropzone: document.getElementById("dropzone"),
    fileInput: document.getElementById("fileInput"),
    fileStatus: document.getElementById("fileStatus"),
    inputText: document.getElementById("inputText"),
    modeSelect: document.getElementById("modeSelect"),
    cipherSelect: document.getElementById("cipherSelect"),
    keyInput: document.getElementById("keyInput"),
    keyHint: document.getElementById("keyHint"),
    runButton: document.getElementById("runButton"),
    outputText: document.getElementById("outputText"),
    resultInfo: document.getElementById("resultInfo"),
    copyButton: document.getElementById("copyButton"),
  };

  function populateCipherSelect() {
    for (const cipher of registry.list()) {
      const option = document.createElement("option");
      option.value = cipher.id;
      option.textContent = cipher.name;
      elements.cipherSelect.append(option);
    }
  }

  function updateModeHint() {
    const mode = elements.modeSelect.value;
    if (mode === "decrypt") {
      elements.keyHint.textContent =
        "Leer lassen, um den Schlüssel automatisch zu knacken.";
    } else {
      elements.keyHint.textContent =
        "Beim Verschlüsseln ist ein Schlüssel empfehlenswert.";
    }
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

  function parseOptionalKey() {
    const raw = elements.keyInput.value.trim();
    if (raw === "") {
      return null;
    }

    const key = Number.parseInt(raw, 10);
    if (Number.isNaN(key)) {
      throw new Error("Schlüssel muss eine ganze Zahl sein.");
    }
    return key;
  }

  function runCipher() {
    const text = elements.inputText.value;
    if (!text.trim()) {
      throw new Error("Bitte zuerst Text eingeben oder eine Datei laden.");
    }

    const mode = elements.modeSelect.value;
    const cipher = registry.get(elements.cipherSelect.value);
    if (!cipher) {
      throw new Error("Keine gültige Verschlüsselung ausgewählt.");
    }

    const key = parseOptionalKey();

    if (mode === "encrypt") {
      if (key == null) {
        throw new Error("Beim Verschlüsseln wird ein Schlüssel benötigt.");
      }
      const encrypted = cipher.encrypt(text, key);
      elements.outputText.value = encrypted;
      setStatus(`${cipher.name}: Text verschlüsselt (Schlüssel: ${key}).`);
      return;
    }

    if (key != null) {
      const decrypted = cipher.decrypt(text, key);
      elements.outputText.value = decrypted;
      setStatus(`${cipher.name}: Text entschlüsselt (Schlüssel: ${key}).`);
      return;
    }

    const cracked = cipher.crack(text);
    elements.outputText.value = cracked.text;
    setStatus(
      `${cipher.name}: Schlüssel geknackt (${cracked.key}), Text entschlüsselt.`
    );
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

    elements.modeSelect.addEventListener("change", updateModeHint);
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
    populateCipherSelect();
    updateModeHint();
    wireEvents();
    setupDragAndDrop();
  }

  init();
})(window);
