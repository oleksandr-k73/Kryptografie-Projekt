(function initRsaMiniCipher(global) {
  const root = global.KryptoCiphers || (global.KryptoCiphers = {});

  function toBigInt(value, label) {
    if (typeof value === "bigint") {
      return value;
    }

    if (typeof value === "number") {
      if (!Number.isFinite(value) || !Number.isInteger(value)) {
        // Nicht-ganzzahlige Werte wuerden spaeter zu stillen Rundungen fuehren.
        throw new Error(`${label} muss eine ganze Zahl sein.`);
      }
      return BigInt(value);
    }

    const source = String(value || "").trim();
    if (!source) {
      // Leere Strings sollen frueh abbrechen, damit UI-Fehler eindeutig bleiben.
      throw new Error(`${label} fehlt.`);
    }
    if (!/^[-+]?\d+$/.test(source)) {
      // Nur Dezimalzahlen sind erlaubt, damit die Eingabe im UI klar bleibt.
      throw new Error(`${label} muss eine ganze Zahl sein.`);
    }
    return BigInt(source);
  }

  function gcd(a, b) {
    let left = a < 0n ? -a : a;
    let right = b < 0n ? -b : b;
    while (right !== 0n) {
      const temp = left % right;
      left = right;
      right = temp;
    }
    return left;
  }

  function modInverse(value, modulus) {
    let a = value % modulus;
    let m = modulus;
    let t = 0n;
    let newT = 1n;
    let r = m;
    let newR = a;

    while (newR !== 0n) {
      const quotient = r / newR;
      [t, newT] = [newT, t - quotient * newT];
      [r, newR] = [newR, r - quotient * newR];
    }

    if (r !== 1n && r !== -1n) {
      // Ohne Inverses kann RSA nicht korrekt ver- oder entschlüsseln.
      throw new Error("Kein modulares Inverses gefunden.");
    }

    if (t < 0n) {
      t += m;
    }

    return t;
  }

  function modPow(base, exponent, modulus) {
    if (modulus === 1n) {
      return 0n;
    }

    let result = 1n;
    let factor = base % modulus;
    let exp = exponent;

    while (exp > 0n) {
      if (exp % 2n === 1n) {
        result = (result * factor) % modulus;
      }
      factor = (factor * factor) % modulus;
      exp /= 2n;
    }

    return result;
  }

  function isPrimeSmall(value) {
    if (value <= 1n) {
      return false;
    }
    if (value === 2n || value === 3n) {
      return true;
    }
    if (value % 2n === 0n) {
      return false;
    }

    for (let i = 3n; i * i <= value; i += 2n) {
      if (value % i === 0n) {
        return false;
      }
    }

    return true;
  }

  function parseTokenNumbers(text) {
    const source = String(text || "").trim();
    if (!source) {
      return [];
    }

    const tokens = source.split(/[\s,;]+/g).filter(Boolean);
    const values = [];

    for (const token of tokens) {
      if (!/^\d+$/.test(token)) {
        // Nur Dezimalzahlen erlauben, damit Eingaben eindeutig bleiben.
        throw new Error("Eingabe darf nur ganze Zahlen enthalten.");
      }
      values.push(BigInt(token));
    }

    return values;
  }

  function formatTokenOutput(values) {
    return values.map((value) => value.toString()).join(" ");
  }

  function parseLabeledPairs(raw, allowedLabels) {
    const source = String(raw || "").trim();
    if (!source) {
      return { pairs: {}, leftovers: [], hasLabels: false };
    }

    const pairs = {};
    const labelRegex = new RegExp(`(${allowedLabels.join("|")})\\s*=\\s*([-+]?\\d+)`, "gi");
    let match = null;

    while ((match = labelRegex.exec(source)) !== null) {
      const label = match[1].toLowerCase();
      pairs[label] = toBigInt(match[2], label);
    }

    const leftovers = source
      .replace(labelRegex, " ")
      .split(/[\s,;]+/g)
      .filter(Boolean);

    return {
      pairs,
      leftovers,
      hasLabels: Object.keys(pairs).length > 0,
    };
  }

  function buildKeyString(key) {
    const parts = [];
    if (key.p != null) {
      parts.push(`p=${key.p}`);
    }
    if (key.q != null) {
      parts.push(`q=${key.q}`);
    }
    if (key.n != null) {
      parts.push(`n=${key.n}`);
    }
    if (key.e != null) {
      parts.push(`e=${key.e}`);
    }
    if (key.d != null) {
      parts.push(`d=${key.d}`);
    }
    return parts.join(", ");
  }

  function normalizeKeyParts(parts) {
    let p = parts.p ?? null;
    let q = parts.q ?? null;
    let n = parts.n ?? null;
    let e = parts.e ?? null;
    let d = parts.d ?? null;

    if (p != null && p <= 1n) {
      throw new Error("p muss größer als 1 sein.");
    }
    if (q != null && q <= 1n) {
      throw new Error("q muss größer als 1 sein.");
    }
    if (n != null && n <= 1n) {
      throw new Error("n muss größer als 1 sein.");
    }
    if (e != null && e <= 0n) {
      throw new Error("e muss größer als 0 sein.");
    }
    if (d != null && d <= 0n) {
      throw new Error("d muss größer als 0 sein.");
    }

    let phi = null;
    if (p != null || q != null) {
      if (p == null || q == null) {
        // p und q werden gemeinsam erwartet, damit phi stabil berechnet werden kann.
        throw new Error("p und q müssen gemeinsam angegeben werden.");
      }
      if (!isPrimeSmall(p) || !isPrimeSmall(q)) {
        // Mini-RSA setzt Primzahlen voraus, sonst sind Inversen unzuverlässig.
        throw new Error("p und q müssen Primzahlen sein.");
      }

      const derivedN = p * q;
      if (n != null && n !== derivedN) {
        // Konsistenzcheck verhindert, dass widersprüchliche Parameter genutzt werden.
        throw new Error("n passt nicht zu p und q.");
      }
      n = derivedN;
      phi = (p - 1n) * (q - 1n);
    }

    if (phi != null) {
      if (e != null) {
        if (gcd(e, phi) !== 1n) {
          // e muss teilerfremd zu phi sein, sonst existiert kein d.
          throw new Error("e ist nicht teilerfremd zu phi(n).");
        }
        if (d == null) {
          d = modInverse(e, phi);
        }
      }

      if (d != null) {
        if (gcd(d, phi) !== 1n) {
          // d muss ebenfalls ein Inverses haben, damit RSA konsistent bleibt.
          throw new Error("d ist nicht teilerfremd zu phi(n).");
        }
        if (e == null) {
          e = modInverse(d, phi);
        } else if ((d * e) % phi !== 1n) {
          // Explizite Prüfung verhindert subtile Inkonsistenzen bei manueller Eingabe.
          throw new Error("e und d sind keine Inversen modulo phi(n).");
        }
      }
    }

    if (n == null) {
      if (e != null || d != null) {
        // Ohne n kann weder ver- noch entschlüsselt werden.
        throw new Error("n wird für RSA benötigt.");
      }
    }

    const key = { p, q, n, e, d };
    key.toString = function keyToString() {
      return buildKeyString(key) || "(leer)";
    };

    return key;
  }

  function parseKey(rawKey) {
    if (rawKey && typeof rawKey === "object" && !Array.isArray(rawKey)) {
      // Direkte Objektübergabe bleibt für Tests und interne Calls erhalten.
      return normalizeKeyParts({
        p: rawKey.p != null ? toBigInt(rawKey.p, "p") : null,
        q: rawKey.q != null ? toBigInt(rawKey.q, "q") : null,
        n: rawKey.n != null ? toBigInt(rawKey.n, "n") : null,
        e: rawKey.e != null ? toBigInt(rawKey.e, "e") : null,
        d: rawKey.d != null ? toBigInt(rawKey.d, "d") : null,
      });
    }

    const source = String(rawKey || "").trim();
    if (!source) {
      throw new Error("RSA-Parameter dürfen nicht leer sein.");
    }

    const parsed = parseLabeledPairs(source, ["p", "q", "n", "e", "d"]);
    if (parsed.hasLabels) {
      if (parsed.leftovers.length > 0) {
        // Teilmengen ohne Labels sollen explizit abgefangen werden.
        throw new Error(
          "RSA-Parameter mit Labels müssen als p=..., q=..., n=..., e=..., d=... angegeben werden."
        );
      }

      return normalizeKeyParts(parsed.pairs);
    }

    if (parsed.leftovers.length === 5) {
      const [p, q, n, e, d] = parsed.leftovers.map((token, index) =>
        toBigInt(token, ["p", "q", "n", "e", "d"][index])
      );
      return normalizeKeyParts({ p, q, n, e, d });
    }

    throw new Error(
      "RSA-Parameter benötigen Labels (p=..., q=..., n=..., e=..., d=...) oder exakt 5 Zahlen."
    );
  }

  function parseCrackHint(rawHint) {
    const parsed = parseLabeledPairs(rawHint, ["d", "n"]);

    if (!parsed.hasLabels) {
      // Crack-Hints sollen explizit d und n nennen, damit keine Zuordnung verloren geht.
      throw new Error("Crack-Hinweis braucht d=... und n=....");
    }

    if (parsed.leftovers.length > 0) {
      throw new Error("Crack-Hinweis darf nur d=... und n=... enthalten.");
    }

    if (parsed.pairs.d == null || parsed.pairs.n == null) {
      throw new Error("Crack-Hinweis braucht d=... und n=....");
    }

    return {
      d: parsed.pairs.d,
      n: parsed.pairs.n,
    };
  }

  function ensureTokenRange(values, n, label) {
    for (const value of values) {
      if (value < 0n || value >= n) {
        // Range-Guards verhindern, dass ungültige RSA-Zustandsräume entstehen.
        throw new Error(`${label} muss im Bereich 0 bis n-1 liegen.`);
      }
    }
  }

  function encryptTokens(tokens, key) {
    const values = tokens.map((token) => modPow(token, key.e, key.n));
    return formatTokenOutput(values);
  }

  function decryptTokens(tokens, key) {
    const values = tokens.map((token) => modPow(token, key.d, key.n));
    return formatTokenOutput(values);
  }

  const rsaMiniCipher = {
    id: "rsa-mini",
    name: "RSA Mini",
    supportsKey: true,
    supportsCrackLengthHint: true,
    crackHintRequired: true,
    supportsRsaParams: true,
    keyLabel: "RSA-Parameter",
    keyPlaceholder: "p=11, q=17, n=187, e=7, d=23",
    crackLengthLabel: "Privater Schlüssel (d,n)",
    crackLengthPlaceholder: "d=23, n=187",
    info: {
      purpose: "Didaktische Mini-RSA-Variante mit Zahlentokens statt Buchstaben.",
      process: "Encrypt nutzt n,e und berechnet m^e mod n je Token; Decrypt nutzt n,d und berechnet c^d mod n.",
      crack: "Kein echtes Key-Cracking: d,n müssen als Hinweis angegeben werden, dann wird deterministisch entschlüsselt.",
      useCase: "Sinnvoll für Unterrichtsbeispiele mit kleinen Primzahlen und klaren Zahlenfolgen.",
    },
    parseKey(rawKey) {
      return parseKey(rawKey);
    },
    parseCrackHint(rawHint) {
      return parseCrackHint(rawHint);
    },
    encrypt(text, key) {
      if (!key || key.n == null || key.e == null) {
        // RSA-Verschlüsselung braucht den öffentlichen Schlüssel.
        throw new Error("RSA-Verschlüsselung benötigt n und e.");
      }

      const n = toBigInt(key.n, "n");
      const e = toBigInt(key.e, "e");
      const tokens = parseTokenNumbers(text);
      ensureTokenRange(tokens, n, "Klartext");

      return encryptTokens(tokens, { n, e });
    },
    decrypt(text, key) {
      if (!key || key.n == null || key.d == null) {
        // RSA-Entschlüsselung nutzt den privaten Schlüssel.
        throw new Error("RSA-Entschlüsselung benötigt n und d.");
      }

      const n = toBigInt(key.n, "n");
      const d = toBigInt(key.d, "d");
      const tokens = parseTokenNumbers(text);
      ensureTokenRange(tokens, n, "Geheimtext");

      return decryptTokens(tokens, { n, d });
    },
    crack(text, options) {
      if (!options || options.d == null || options.n == null) {
        // Ohne d,n kann RSA-Mini nicht knacken, daher klare UI-Fehlermeldung.
        throw new Error("Crack benötigt d und n als Hinweis.");
      }

      const n = toBigInt(options.n, "n");
      const d = toBigInt(options.d, "d");
      const tokens = parseTokenNumbers(text);
      ensureTokenRange(tokens, n, "Geheimtext");

      const plaintext = decryptTokens(tokens, { n, d });
      return {
        key: `d=${d}, n=${n}`,
        text: plaintext,
        confidence: 1,
      };
    },
  };

  root.rsaMiniCipher = rsaMiniCipher;
})(typeof window !== "undefined" ? window : globalThis);
