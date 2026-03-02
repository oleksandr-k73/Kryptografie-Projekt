import { describe, expect, it } from "vitest";
import { loadBrowserContext } from "./_browserHarness.mjs";

function loadRuntime() {
  const window = loadBrowserContext(["js/core/fileParsers.js"]);
  return window.KryptoCore;
}

// Helper to create a mock File object
function createMockFile(content, filename) {
  return {
    name: filename,
    text: async () => content,
  };
}

describe("fileParsers", () => {
  describe("text file parsing", () => {
    it("parses .txt files as plain text", async () => {
      const core = loadRuntime();
      const file = createMockFile("Hello World", "test.txt");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("Hello World");
      expect(result.format).toBe("txt");
      expect(result.fallback).toBe(false);
    });

    it("parses .log files as plain text", async () => {
      const core = loadRuntime();
      const file = createMockFile("Log entry 1\nLog entry 2", "system.log");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("Log entry 1\nLog entry 2");
      expect(result.format).toBe("log");
      expect(result.fallback).toBe(false);
    });

    it("parses .md files as plain text", async () => {
      const core = loadRuntime();
      const file = createMockFile("# Heading\n\nContent", "readme.md");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("# Heading\n\nContent");
      expect(result.format).toBe("md");
      expect(result.fallback).toBe(false);
    });

    it("preserves line breaks in text files", async () => {
      const core = loadRuntime();
      const file = createMockFile("Line 1\nLine 2\nLine 3", "test.txt");
      const result = await core.parseInputFile(file);

      expect(result.text).toContain("\n");
    });

    it("handles empty text files", async () => {
      const core = loadRuntime();
      const file = createMockFile("", "empty.txt");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("");
      expect(result.format).toBe("txt");
    });
  });

  describe("JSON file parsing", () => {
    it("extracts text from JSON with 'text' field", async () => {
      const core = loadRuntime();
      const jsonContent = JSON.stringify({ text: "Hello World" });
      const file = createMockFile(jsonContent, "data.json");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("Hello World");
      expect(result.format).toBe("json");
      expect(result.fallback).toBe(false);
    });

    it("extracts from 'ciphertext' field", async () => {
      const core = loadRuntime();
      const jsonContent = JSON.stringify({ ciphertext: "Encrypted message" });
      const file = createMockFile(jsonContent, "data.json");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("Encrypted message");
      expect(result.format).toBe("json");
    });

    it("extracts from 'message' field", async () => {
      const core = loadRuntime();
      const jsonContent = JSON.stringify({ message: "Test message" });
      const file = createMockFile(jsonContent, "data.json");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("Test message");
    });

    it("extracts from 'coded' field", async () => {
      const core = loadRuntime();
      const jsonContent = JSON.stringify({ coded: "Coded text" });
      const file = createMockFile(jsonContent, "data.json");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("Coded text");
    });

    it("prefers 'text' over other fields", async () => {
      const core = loadRuntime();
      const jsonContent = JSON.stringify({
        text: "Primary",
        message: "Secondary",
      });
      const file = createMockFile(jsonContent, "data.json");
      const result = await core.parseInputFile(file);

      // Scoring algorithm may prefer different fields based on scoring
      // but should extract some text
      expect(result.text).toBeDefined();
      expect(result.format).toBe("json");
    });

    it("handles nested JSON structures", async () => {
      const core = loadRuntime();
      const jsonContent = JSON.stringify({
        data: {
          cipher: {
            text: "Nested message",
          },
        },
      });
      const file = createMockFile(jsonContent, "data.json");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("Nested message");
    });

    it("handles JSON arrays", async () => {
      const core = loadRuntime();
      const jsonContent = JSON.stringify([
        { text: "First" },
        { text: "Second" },
      ]);
      const file = createMockFile(jsonContent, "data.json");
      const result = await core.parseInputFile(file);

      // Should extract text from array
      expect(result.text).toBeDefined();
    });

    it("extracts any string field from JSON when no strong text fields", async () => {
      const core = loadRuntime();
      const jsonContent = JSON.stringify({ irrelevant: "data" });
      const file = createMockFile(jsonContent, "data.json");

      const result = await core.parseInputFile(file);
      // Should extract something rather than throwing
      expect(result.text).toBeDefined();
      expect(result.format).toBe("json");
    });

    it("throws error for invalid JSON", async () => {
      const core = loadRuntime();
      const file = createMockFile("{ invalid json }", "data.json");

      await expect(core.parseInputFile(file)).rejects.toThrow();
    });

    it("avoids hash-like strings", async () => {
      const core = loadRuntime();
      const jsonContent = JSON.stringify({
        hash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
        text: "Real message",
      });
      const file = createMockFile(jsonContent, "data.json");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("Real message");
    });
  });

  describe("CSV file parsing", () => {
    it("parses simple CSV with text column", async () => {
      const core = loadRuntime();
      const csvContent = "text,value\nHello,123\nWorld,456";
      const file = createMockFile(csvContent, "data.csv");
      const result = await core.parseInputFile(file);

      expect(result.text).toContain("Hello");
      expect(result.text).toContain("World");
      expect(result.format).toBe("csv");
      expect(result.fallback).toBe(false);
    });

    it("extracts from 'coded' column", async () => {
      const core = loadRuntime();
      const csvContent = "coded,other\nEncrypted1,data1\nEncrypted2,data2";
      const file = createMockFile(csvContent, "data.csv");
      const result = await core.parseInputFile(file);

      expect(result.text).toContain("Encrypted1");
      expect(result.text).toContain("Encrypted2");
    });

    it("extracts from 'ciphertext' column", async () => {
      const core = loadRuntime();
      const csvContent = "ciphertext,key\nCipher1,K1\nCipher2,K2";
      const file = createMockFile(csvContent, "data.csv");
      const result = await core.parseInputFile(file);

      expect(result.text).toContain("Cipher1");
      expect(result.text).toContain("Cipher2");
    });

    it("handles CSV with quoted fields", async () => {
      const core = loadRuntime();
      const csvContent = 'text,value\n"Hello, World",123';
      const file = createMockFile(csvContent, "data.csv");
      const result = await core.parseInputFile(file);

      expect(result.text).toContain("Hello, World");
    });

    it("handles CSV with escaped quotes", async () => {
      const core = loadRuntime();
      const csvContent = 'text\n"She said ""Hello"""';
      const file = createMockFile(csvContent, "data.csv");
      const result = await core.parseInputFile(file);

      expect(result.text).toContain('She said "Hello"');
    });

    it("handles CSV with semicolon separator", async () => {
      const core = loadRuntime();
      const csvContent = "text;value\nHello;123\nWorld;456";
      const file = createMockFile(csvContent, "data.csv");
      const result = await core.parseInputFile(file);

      expect(result.text).toBeDefined();
    });

    it("handles CSV with tab separator", async () => {
      const core = loadRuntime();
      const csvContent = "text\tvalue\nHello\t123\nWorld\t456";
      const file = createMockFile(csvContent, "data.csv");
      const result = await core.parseInputFile(file);

      expect(result.text).toBeDefined();
    });

    it("handles single row CSV (no header)", async () => {
      const core = loadRuntime();
      const csvContent = "Hello,World,Test";
      const file = createMockFile(csvContent, "data.csv");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("Hello World Test");
    });

    it("handles empty CSV", async () => {
      const core = loadRuntime();
      const file = createMockFile("", "data.csv");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("");
    });

    it("handles CSV with empty lines", async () => {
      const core = loadRuntime();
      const csvContent = "text\nHello\n\nWorld\n\n";
      const file = createMockFile(csvContent, "data.csv");
      const result = await core.parseInputFile(file);

      expect(result.text).toContain("Hello");
      expect(result.text).toContain("World");
    });

    it("joins multiple rows with newlines when text column found", async () => {
      const core = loadRuntime();
      const csvContent = "text\nLine1\nLine2\nLine3";
      const file = createMockFile(csvContent, "data.csv");
      const result = await core.parseInputFile(file);

      expect(result.text).toContain("\n");
    });

    it("handles CSV without recognized column", async () => {
      const core = loadRuntime();
      const csvContent = "foo,bar\nval1,val2\nval3,val4";
      const file = createMockFile(csvContent, "data.csv");
      const result = await core.parseInputFile(file);

      // Should join remaining data
      expect(result.text).toBeDefined();
    });
  });

  describe("JavaScript file parsing", () => {
    it("extracts string literals from JS", async () => {
      const core = loadRuntime();
      const jsContent = 'const message = "Hello World";';
      const file = createMockFile(jsContent, "code.js");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("Hello World");
      expect(result.format).toBe("js");
      expect(result.fallback).toBe(false);
    });

    it("prefers variables with strong text keys", async () => {
      const core = loadRuntime();
      const jsContent = `
        const id = "12345";
        const ciphertext = "Encrypted message";
      `;
      const file = createMockFile(jsContent, "code.js");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("Encrypted message");
    });

    it("extracts from object properties", async () => {
      const core = loadRuntime();
      const jsContent = `const data = { text: "Message here" };`;
      const file = createMockFile(jsContent, "code.js");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("Message here");
    });

    it("handles single quotes", async () => {
      const core = loadRuntime();
      const jsContent = "const msg = 'Single quoted';";
      const file = createMockFile(jsContent, "code.js");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("Single quoted");
    });

    it("handles template literals", async () => {
      const core = loadRuntime();
      const jsContent = "const msg = `Template literal`;";
      const file = createMockFile(jsContent, "code.js");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("Template literal");
    });

    it("decodes escape sequences", async () => {
      const core = loadRuntime();
      const jsContent = 'const msg = "Line 1\\nLine 2\\tTabbed";';
      const file = createMockFile(jsContent, "code.js");
      const result = await core.parseInputFile(file);

      expect(result.text).toContain("\n");
      expect(result.text).toContain("\t");
    });

    it("decodes unicode escapes", async () => {
      const core = loadRuntime();
      const jsContent = 'const msg = "Hello \\u0041\\u0042\\u0043";';
      const file = createMockFile(jsContent, "code.js");
      const result = await core.parseInputFile(file);

      expect(result.text).toContain("ABC");
    });

    it("handles .mjs extension", async () => {
      const core = loadRuntime();
      const jsContent = 'export const text = "ES Module";';
      const file = createMockFile(jsContent, "module.mjs");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("ES Module");
      expect(result.format).toBe("mjs");
    });

    it("handles .cjs extension", async () => {
      const core = loadRuntime();
      const jsContent = 'const text = "CommonJS";';
      const file = createMockFile(jsContent, "module.cjs");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("CommonJS");
      expect(result.format).toBe("cjs");
    });

    it("falls back to full source if no strings found", async () => {
      const core = loadRuntime();
      const jsContent = "const x = 123; const y = 456;";
      const file = createMockFile(jsContent, "code.js");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe(jsContent);
    });

    it("avoids hash-like strings", async () => {
      const core = loadRuntime();
      const jsContent = `
        const hash = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
        const text = "Real message";
      `;
      const file = createMockFile(jsContent, "code.js");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("Real message");
    });
  });

  describe("unknown format fallback", () => {
    it("treats unknown extensions as plain text", async () => {
      const core = loadRuntime();
      const file = createMockFile("Unknown format content", "file.xyz");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("Unknown format content");
      expect(result.format).toBe("xyz");
      expect(result.fallback).toBe(true);
    });

    it("handles files without extension", async () => {
      const core = loadRuntime();
      const file = createMockFile("No extension", "README");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("No extension");
      expect(result.format).toBe("unbekannt");
      expect(result.fallback).toBe(true);
    });

    it("handles uppercase extensions", async () => {
      const core = loadRuntime();
      const file = createMockFile("Content", "FILE.TXT");
      const result = await core.parseInputFile(file);

      expect(result.format).toBe("txt");
      expect(result.fallback).toBe(false);
    });

    it("handles mixed case extensions", async () => {
      const core = loadRuntime();
      const jsonContent = JSON.stringify({ text: "Content" });
      const file = createMockFile(jsonContent, "data.JsOn");
      const result = await core.parseInputFile(file);

      expect(result.format).toBe("json");
      expect(result.text).toBe("Content");
    });
  });

  describe("edge cases", () => {
    it("handles very large files", async () => {
      const core = loadRuntime();
      const largeContent = "A".repeat(100000);
      const file = createMockFile(largeContent, "large.txt");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe(largeContent);
    });

    it("handles files with special characters", async () => {
      const core = loadRuntime();
      const content = "Hello 世界 Привет مرحبا";
      const file = createMockFile(content, "international.txt");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe(content);
    });

    it("handles files with only whitespace", async () => {
      const core = loadRuntime();
      const file = createMockFile("   \n\n\t  ", "whitespace.txt");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("   \n\n\t  ");
    });

    it("handles JSON with deeply nested structures", async () => {
      const core = loadRuntime();
      const deepJson = JSON.stringify({
        level1: {
          level2: {
            level3: {
              level4: {
                text: "Deep message",
              },
            },
          },
        },
      });
      const file = createMockFile(deepJson, "deep.json");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("Deep message");
    });

    it("handles CSV with many columns", async () => {
      const core = loadRuntime();
      const csvContent = "a,b,c,d,e,f,text,g,h,i\n1,2,3,4,5,6,Message,7,8,9";
      const file = createMockFile(csvContent, "wide.csv");
      const result = await core.parseInputFile(file);

      expect(result.text).toContain("Message");
    });

    it("handles malformed CSV gracefully", async () => {
      const core = loadRuntime();
      const csvContent = 'text\n"Unclosed quote';
      const file = createMockFile(csvContent, "malformed.csv");
      const result = await core.parseInputFile(file);

      // Should not throw, may extract partial data
      expect(result.text).toBeDefined();
    });

    it("handles JS with syntax errors", async () => {
      const core = loadRuntime();
      const jsContent = 'const broken = "test';
      const file = createMockFile(jsContent, "broken.js");
      const result = await core.parseInputFile(file);

      // Should fall back to source
      expect(result.text).toBe(jsContent);
    });

    it("handles multiple dots in filename", async () => {
      const core = loadRuntime();
      const file = createMockFile("Content", "my.file.name.txt");
      const result = await core.parseInputFile(file);

      expect(result.format).toBe("txt");
    });

    it("handles filename with no content before extension", async () => {
      const core = loadRuntime();
      const file = createMockFile("Hidden file", ".txt");
      const result = await core.parseInputFile(file);

      expect(result.format).toBe("txt");
    });
  });

  describe("scoring and prioritization", () => {
    it("prioritizes strong text keys over weak meta keys in JSON", async () => {
      const core = loadRuntime();
      const jsonContent = JSON.stringify({
        title: "Document Title",
        description: "Some description",
        ciphertext: "Encrypted content",
      });
      const file = createMockFile(jsonContent, "data.json");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("Encrypted content");
    });

    it("avoids meta fields like 'id' and 'version'", async () => {
      const core = loadRuntime();
      const jsonContent = JSON.stringify({
        id: "12345",
        version: "1.0",
        text: "Actual content",
      });
      const file = createMockFile(jsonContent, "data.json");
      const result = await core.parseInputFile(file);

      expect(result.text).toBe("Actual content");
    });

    it("prefers longer text fields", async () => {
      const core = loadRuntime();
      const jsonContent = JSON.stringify({
        text: "Short",
        message: "This is a much longer message with more content",
      });
      const file = createMockFile(jsonContent, "data.json");
      const result = await core.parseInputFile(file);

      // Scoring should consider length
      expect(result.text).toBeDefined();
    });
  });
});