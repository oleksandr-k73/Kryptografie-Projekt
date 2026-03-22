(function initSha256Cipher(global) {
  const root = global.KryptoCiphers || (global.KryptoCiphers = {});

  // Precomputed SHA-256 constants (K-Werte) – einmalig init, keine Recompute pro Hash.
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  function encodeUtf8(text) {
    const source = String(text || "");

    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(source);
    }

    if (typeof Buffer !== "undefined") {
      return Uint8Array.from(Buffer.from(source, "utf8"));
    }

    // Fallback ohne Browser-APIs
    const encoded = unescape(encodeURIComponent(source));
    const bytes = new Uint8Array(encoded.length);
    for (let index = 0; index < encoded.length; index += 1) {
      bytes[index] = encoded.charCodeAt(index);
    }
    return bytes;
  }

  function rightRotate(value, amount) {
    // 32-bit: >>> 0 hält bitops konsistent in JS
    return ((value >>> amount) | (value << (32 - amount))) >>> 0;
  }

  function bytesToHex(bytes) {
    let hex = "";
    for (const byte of bytes) {
      // Hex-Wert wird zero-padded zu 2 Zeichen und uppercase
      hex += ("0" + byte.toString(16).toUpperCase()).slice(-2);
    }
    return hex;
  }

  function sha256(text) {
    const bytes = encodeUtf8(text);

    // Initiale Hash-Werte
    let h0 = 0x6a09e667;
    let h1 = 0xbb67ae85;
    let h2 = 0x3c6ef372;
    let h3 = 0xa54ff53a;
    let h4 = 0x510e527f;
    let h5 = 0x9b05688c;
    let h6 = 0x1f83d9ab;
    let h7 = 0x5be0cd19;

    const msgLen = bytes.length;
    const msgLenBits = msgLen * 8;
    const blockLen = 512 / 8;
    const paddedLen = Math.ceil((msgLen + 1 + 8) / blockLen) * blockLen;
    const padded = new Uint8Array(paddedLen);

    padded.set(bytes);
    padded[msgLen] = 0x80;

    // 64-bit length Big-Endian am Ende
    const lengthBytes = new Uint32Array([
      Math.floor(msgLenBits / 0x100000000),
      msgLenBits >>> 0,
    ]);
    padded[paddedLen - 8] = (lengthBytes[0] >>> 24) & 0xff;
    padded[paddedLen - 7] = (lengthBytes[0] >>> 16) & 0xff;
    padded[paddedLen - 6] = (lengthBytes[0] >>> 8) & 0xff;
    padded[paddedLen - 5] = lengthBytes[0] & 0xff;
    padded[paddedLen - 4] = (lengthBytes[1] >>> 24) & 0xff;
    padded[paddedLen - 3] = (lengthBytes[1] >>> 16) & 0xff;
    padded[paddedLen - 2] = (lengthBytes[1] >>> 8) & 0xff;
    padded[paddedLen - 1] = lengthBytes[1] & 0xff;

    for (let offset = 0; offset < paddedLen; offset += blockLen) {
      const w = new Uint32Array(64);

      // Erste 16 Worte Big-Endian aus Block
      for (let i = 0; i < 16; i += 1) {
        const idx = offset + i * 4;
        w[i] =
          ((padded[idx] << 24) |
            (padded[idx + 1] << 16) |
            (padded[idx + 2] << 8) |
            padded[idx + 3]) >>>
          0;
      }

      // W[16..63]: Diffusion für Kryptosicherheit
      for (let i = 16; i < 64; i += 1) {
        const s0 = (rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3)) >>> 0;
        const s1 = (rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10)) >>> 0;
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }

      // Serienwerte: h0-h7 werden pro Block aktualisiert
      let a = h0;
      let b = h1;
      let c = h2;
      let d = h3;
      let e = h4;
      let f = h5;
      let g = h6;
      let h = h7;

      // 64-Runden der Compression-Funktion: jede Runde mischt W[i], Konstante K[i] und Zustand.
      // Diese Schritte sind zeitintensiv, daher nutzen wir 32-bit-Arithmetik konsistent.
      for (let i = 0; i < 64; i += 1) {
        const S1 = (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) >>> 0;
        const ch = ((e & f) ^ ((~e) & g)) >>> 0;
        const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) >>> 0;
        const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        const temp2 = (S0 + maj) >>> 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }

      // Neue Hash-Werte für den nächsten Block:
      h0 = (h0 + a) >>> 0;
      h1 = (h1 + b) >>> 0;
      h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0;
      h5 = (h5 + f) >>> 0;
      h6 = (h6 + g) >>> 0;
      h7 = (h7 + h) >>> 0;
    }

    // Finale Hash wird als 8 32-bit Worte Big-Endian zu 32 Bytes kombiniert
    const digest = new Uint8Array(32);
    const hashes = [h0, h1, h2, h3, h4, h5, h6, h7];

    for (let i = 0; i < 8; i += 1) {
      digest[i * 4] = (hashes[i] >>> 24) & 0xff;
      digest[i * 4 + 1] = (hashes[i] >>> 16) & 0xff;
      digest[i * 4 + 2] = (hashes[i] >>> 8) & 0xff;
      digest[i * 4 + 3] = hashes[i] & 0xff;
    }

    return bytesToHex(digest);
  }

  function isValidSha256Hash(text) {
    // SHA-256 gibt einen 256-bit hash aus, das sind 64 hexadezimale Zeichen.
    // Eingaben müssen exakt dieses Format erfüllen, sonst können sie kein Hash sein.
    const normalized = String(text || "").toUpperCase().replace(/\s+/g, "");
    return /^[A-F0-9]{64}$/.test(normalized);
  }

  root.sha256Cipher = {
    id: "sha-256",
    name: "SHA-256",
    supportsKey: false,
    info: {
      purpose: "256-Bit-Hashfunktion für sichere Fingerabdrücke.",
      process: "Text → 512-Bit-Blöcke → math. Ops → 64-HEX.",
      crack: "Einwegfunktion: nur Kandidaten-Vergleich möglich.",
      useCase: "Blockchain, Signaturen, Passwort-Hashing.",
      note: "Entschlüsselung ist Work in Progress (nur Kandidatenvergleich).",
    },

    encrypt(text) {
      // SHA-256 ist eine Einwegfunktion: „Encryption" ist das Hashing selbst.
      const hash = sha256(text);
      return hash;
    },

    decrypt(text) {
      // SHA-256 ist nicht umkehrbar: Entschlüsselung ist mathematisch unmöglich.
      // Wir werfen einen klaren Fehler, damit Nutzer verstehen, warum Decrypt nicht funktioniert.
      throw new Error(
        "SHA-256 ist eine Einwegfunktion und kann nicht entschlüsselt werden. " +
        "Nutze stattdessen den Modus 'Entschlüsseln' mit Kandidaten zum Vergleichen."
      );
    },

    crack(text, options) {
      // Der Text muss ein gültiger 64-stelliger hex-String sein, sonst ist er kein SHA-256-Hashwert.
      if (!isValidSha256Hash(text)) {
        return {
          text: null,
          confidence: -Infinity,
          search: {
            wip: true,
            wipMessage: "SHA-256: Eingabe ist kein gültiger 64-stelliger Hexadezimal-Hash.",
          },
        };
      }

      const normalizedInput = String(text || "").toUpperCase().replace(/\s+/g, "");
      const candidates = Array.isArray(options && options.candidates) ? options.candidates : [];

      // Wenn keine Kandidaten bereitgestellt sind, können wir nicht knacken:
      // Nur mit einer Kandidaten-Liste lässt sich ein Hash verifizieren.
      if (candidates.length === 0) {
        return {
          text: null,
          confidence: -Infinity,
          search: {
            wip: true,
            wipMessage: "SHA-256: Entschlüsselung ist Work in Progress (nur Kandidatenvergleich).",
          },
        };
      }

      // Wir vergleichen den Input-Hash gegen alle Kandidaten-Plaintexts.
      // Wenn wir einen Match finden, haben wir den Original-Text gefunden.
      for (const candidate of candidates) {
        const candidateHash = sha256(String(candidate || "")).toUpperCase();
        if (candidateHash === normalizedInput) {
          // Match gefunden: Wir geben die Plaintext mit hohem Confidence zurück.
          return {
            text: String(candidate),
            confidence: 100,
            candidates: [
              {
                text: String(candidate),
                confidence: 100,
              },
            ],
          };
        }
      }

      // Keine Übereinstimmung gefunden: Die Plaintext ist nicht in den Kandidaten enthalten.
      return {
        text: null,
        confidence: -Infinity,
        search: {
          wip: true,
          wipMessage: "SHA-256: Keine Plaintext in den Kandidaten gefunden.",
        },
      };
    },
  };
})(window);
