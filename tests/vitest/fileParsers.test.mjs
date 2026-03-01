import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("fileParsers", () => {
  let parseInputFile;

  beforeAll(() => {
    const global = {};
    const code = readFileSync(
      join(process.cwd(), "js/core/fileParsers.js"),
      "utf-8"
    );
    const fn = new Function("window", code);
    fn(global);
    parseInputFile = global.KryptoCore.parseInputFile;
  });

  // Helper to create a mock File object
  function createMockFile(content, name) {
    return {
      name,
      text: async () => content,
    };
  }

  describe("txt file parsing", () => {
    it("should parse plain text file", async () => {
      const file = createMockFile("Hello World", "test.txt");
      const result = await parseInputFile(file);

      expect(result.text).toBe("Hello World");
      expect(result.format).toBe("txt");
      expect(result.fallback).toBe(false);
    });

    it("should handle multiline text", async () => {
      const content = "Line 1\nLine 2\nLine 3";
      const file = createMockFile(content, "test.txt");
      const result = await parseInputFile(file);

      expect(result.text).toBe(content);
      expect(result.format).toBe("txt");
    });

    it("should handle empty txt file", async () => {
      const file = createMockFile("", "test.txt");
      const result = await parseInputFile(file);

      expect(result.text).toBe("");
      expect(result.format).toBe("txt");
    });
  });

  describe("log file parsing", () => {
    it("should parse log files like txt", async () => {
      const file = createMockFile("Log entry 1\nLog entry 2", "test.log");
      const result = await parseInputFile(file);

      expect(result.text).toBe("Log entry 1\nLog entry 2");
      expect(result.format).toBe("log");
      expect(result.fallback).toBe(false);
    });
  });

  describe("md file parsing", () => {
    it("should parse markdown files like txt", async () => {
      const content = "# Heading\n\nParagraph text";
      const file = createMockFile(content, "test.md");
      const result = await parseInputFile(file);

      expect(result.text).toBe(content);
      expect(result.format).toBe("md");
      expect(result.fallback).toBe(false);
    });
  });

  describe("json file parsing", () => {
    it("should extract text from simple JSON object", async () => {
      const json = JSON.stringify({ text: "Hello World" });
      const file = createMockFile(json, "test.json");
      const result = await parseInputFile(file);

      expect(result.text).toBe("Hello World");
      expect(result.format).toBe("json");
      expect(result.fallback).toBe(false);
    });

    it("should extract text from nested JSON", async () => {
      const json = JSON.stringify({
        data: {
          message: "Nested message",
        },
      });
      const file = createMockFile(json, "test.json");
      const result = await parseInputFile(file);

      expect(result.text).toBe("Nested message");
      expect(result.format).toBe("json");
    });

    it("should prefer strong text keys", async () => {
      const json = JSON.stringify({
        title: "Title",
        ciphertext: "This is the ciphertext",
      });
      const file = createMockFile(json, "test.json");
      const result = await parseInputFile(file);

      expect(result.text).toBe("This is the ciphertext");
    });

    it("should extract from array of objects", async () => {
      const json = JSON.stringify([
        { text: "First" },
        { text: "Second with more content" },
      ]);
      const file = createMockFile(json, "test.json");
      const result = await parseInputFile(file);

      expect(result.text).toContain("content");
    });

    it("should avoid hash-like strings", async () => {
      const json = JSON.stringify({
        hash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
        text: "Real text here",
      });
      const file = createMockFile(json, "test.json");
      const result = await parseInputFile(file);

      expect(result.text).toBe("Real text here");
    });

    it("should avoid metadata fields", async () => {
      const json = JSON.stringify({
        id: "123",
        version: "1.0",
        content: "The actual content",
      });
      const file = createMockFile(json, "test.json");
      const result = await parseInputFile(file);

      expect(result.text).toBe("The actual content");
    });

    it("should extract best available field from JSON", async () => {
      // Parser scores all fields and extracts the best one available
      const json = JSON.stringify({
        id: "123",
        version: "1.0",
      });
      const file = createMockFile(json, "test.json");

      const result = await parseInputFile(file);
      // Will extract one of the available fields
      expect(result.text).toBeDefined();
      expect(result.format).toBe("json");
    });

    it("should prefer longer text content", async () => {
      const json = JSON.stringify({
        text: "Short",
        body: "This is a much longer text that should be preferred",
      });
      const file = createMockFile(json, "test.json");
      const result = await parseInputFile(file);

      expect(result.text.length).toBeGreaterThan(10);
    });
  });

  describe("csv file parsing", () => {
    it("should parse CSV with text column", async () => {
      const csv = "text,value\nHello,1\nWorld,2";
      const file = createMockFile(csv, "test.csv");
      const result = await parseInputFile(file);

      expect(result.text).toBe("Hello\nWorld");
      expect(result.format).toBe("csv");
      expect(result.fallback).toBe(false);
    });

    it("should handle message column", async () => {
      const csv = "id,message\n1,First message\n2,Second message";
      const file = createMockFile(csv, "test.csv");
      const result = await parseInputFile(file);

      expect(result.text).toBe("First message\nSecond message");
    });

    it("should handle ciphertext column", async () => {
      const csv = "ciphertext,key\nENCRYPTED,3";
      const file = createMockFile(csv, "test.csv");
      const result = await parseInputFile(file);

      expect(result.text).toBe("ENCRYPTED");
    });

    it("should handle CSV without recognized column", async () => {
      const csv = "col1,col2\nval1,val2\nval3,val4";
      const file = createMockFile(csv, "test.csv");
      const result = await parseInputFile(file);

      expect(result.text).toContain("val1");
      expect(result.text).toContain("val2");
    });

    it("should handle quoted CSV values", async () => {
      const csv = 'text\n"Hello, World"\n"Second, Line"';
      const file = createMockFile(csv, "test.csv");
      const result = await parseInputFile(file);

      expect(result.text).toContain("Hello, World");
    });

    it("should handle escaped quotes in CSV", async () => {
      const csv = 'text\n"He said ""Hello"""';
      const file = createMockFile(csv, "test.csv");
      const result = await parseInputFile(file);

      expect(result.text).toContain('He said "Hello"');
    });

    it("should handle semicolon delimiter", async () => {
      const csv = "text;value\nHello;1\nWorld;2";
      const file = createMockFile(csv, "test.csv");
      const result = await parseInputFile(file);

      expect(result.text).toBe("Hello\nWorld");
    });

    it("should handle tab delimiter", async () => {
      const csv = "text\tvalue\nHello\t1\nWorld\t2";
      const file = createMockFile(csv, "test.csv");
      const result = await parseInputFile(file);

      expect(result.text).toBe("Hello\nWorld");
    });

    it("should handle empty CSV", async () => {
      const file = createMockFile("", "test.csv");
      const result = await parseInputFile(file);

      expect(result.text).toBe("");
    });

    it("should trim whitespace from cells", async () => {
      const csv = "text\n  Hello  \n  World  ";
      const file = createMockFile(csv, "test.csv");
      const result = await parseInputFile(file);

      expect(result.text).toBe("Hello\nWorld");
    });
  });

  describe("js file parsing", () => {
    it("should extract string from const assignment", async () => {
      const js = 'const ciphertext = "Hello World";';
      const file = createMockFile(js, "test.js");
      const result = await parseInputFile(file);

      expect(result.text).toBe("Hello World");
      expect(result.format).toBe("js");
      expect(result.fallback).toBe(false);
    });

    it("should extract string from let assignment", async () => {
      const js = 'let message = "Test message";';
      const file = createMockFile(js, "test.js");
      const result = await parseInputFile(file);

      expect(result.text).toBe("Test message");
    });

    it("should extract string from object property", async () => {
      const js = 'const obj = { text: "Extracted text" };';
      const file = createMockFile(js, "test.js");
      const result = await parseInputFile(file);

      expect(result.text).toBe("Extracted text");
    });

    it("should prefer strong text keys", async () => {
      const js = `
        const obj = {
          title: "Title",
          ciphertext: "This is the ciphertext"
        };
      `;
      const file = createMockFile(js, "test.js");
      const result = await parseInputFile(file);

      expect(result.text).toBe("This is the ciphertext");
    });

    it("should handle single quotes", async () => {
      const js = "const text = 'Single quoted';";
      const file = createMockFile(js, "test.js");
      const result = await parseInputFile(file);

      expect(result.text).toBe("Single quoted");
    });

    it("should handle template literals", async () => {
      const js = "const text = `Template literal`;";
      const file = createMockFile(js, "test.js");
      const result = await parseInputFile(file);

      expect(result.text).toBe("Template literal");
    });

    it("should handle escape sequences", async () => {
      const js = 'const text = "Line1\\nLine2";';
      const file = createMockFile(js, "test.js");
      const result = await parseInputFile(file);

      expect(result.text).toContain("\n");
    });

    it("should handle unicode escapes", async () => {
      const js = 'const text = "\\u0048\\u0065\\u006C\\u006C\\u006F";';
      const file = createMockFile(js, "test.js");
      const result = await parseInputFile(file);

      expect(result.text).toBe("Hello");
    });

    it("should handle quoted property keys", async () => {
      const js = 'const obj = { "text": "value" };';
      const file = createMockFile(js, "test.js");
      const result = await parseInputFile(file);

      expect(result.text).toBe("value");
    });

    it("should fallback to original if no strings found", async () => {
      const js = "const x = 123;";
      const file = createMockFile(js, "test.js");
      const result = await parseInputFile(file);

      expect(result.text).toBe(js);
    });
  });

  describe("mjs file parsing", () => {
    it("should parse mjs files like js", async () => {
      const mjs = 'export const text = "Module text";';
      const file = createMockFile(mjs, "test.mjs");
      const result = await parseInputFile(file);

      expect(result.text).toBe("Module text");
      expect(result.format).toBe("mjs");
    });
  });

  describe("cjs file parsing", () => {
    it("should parse cjs files like js", async () => {
      const cjs = 'const text = "CommonJS text"; module.exports = text;';
      const file = createMockFile(cjs, "test.cjs");
      const result = await parseInputFile(file);

      expect(result.text).toBe("CommonJS text");
      expect(result.format).toBe("cjs");
    });
  });

  describe("unknown file types", () => {
    it("should use fallback for unknown extensions", async () => {
      const file = createMockFile("Unknown content", "test.xyz");
      const result = await parseInputFile(file);

      expect(result.text).toBe("Unknown content");
      expect(result.format).toBe("xyz");
      expect(result.fallback).toBe(true);
    });

    it("should use fallback for files without extension", async () => {
      const file = createMockFile("No extension", "README");
      const result = await parseInputFile(file);

      expect(result.text).toBe("No extension");
      expect(result.format).toBe("unbekannt");
      expect(result.fallback).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle case-insensitive extensions", async () => {
      const file = createMockFile("Test", "file.TXT");
      const result = await parseInputFile(file);

      expect(result.format).toBe("txt");
      expect(result.fallback).toBe(false);
    });

    it("should handle multiple dots in filename", async () => {
      const file = createMockFile("Test", "file.backup.txt");
      const result = await parseInputFile(file);

      expect(result.format).toBe("txt");
    });

    it("should handle very long text", async () => {
      const longText = "x".repeat(10000);
      const file = createMockFile(longText, "test.txt");
      const result = await parseInputFile(file);

      expect(result.text).toBe(longText);
    });

    it("should handle special characters", async () => {
      const text = "äöü ß © ® €";
      const file = createMockFile(text, "test.txt");
      const result = await parseInputFile(file);

      expect(result.text).toBe(text);
    });

    it("should handle JSON with deeply nested structure", async () => {
      const json = JSON.stringify({
        level1: {
          level2: {
            level3: {
              level4: {
                text: "Deep text",
              },
            },
          },
        },
      });
      const file = createMockFile(json, "test.json");
      const result = await parseInputFile(file);

      expect(result.text).toBe("Deep text");
    });

    it("should score JSON candidates correctly", async () => {
      const json = JSON.stringify({
        id: "abc",
        hash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        payload: "This is the actual payload content",
      });
      const file = createMockFile(json, "test.json");
      const result = await parseInputFile(file);

      expect(result.text).toBe("This is the actual payload content");
    });

    it("should handle CSV with missing values", async () => {
      const csv = "text,value\nHello,\n,World\nFull,Data";
      const file = createMockFile(csv, "test.csv");
      const result = await parseInputFile(file);

      expect(result.text).toContain("Hello");
      // Empty cells result in empty lines
      expect(result.text).toContain("Full");
    });

    it("should handle JS with template literal placeholders", async () => {
      const js = "const text = `Hello ${name}`;";
      const file = createMockFile(js, "test.js");
      const result = await parseInputFile(file);

      // Placeholders should be replaced with space
      expect(result.text).toContain("Hello");
    });

    it("should handle content field in JSON", async () => {
      const json = JSON.stringify({
        content: "The content value",
        other: "Other value",
      });
      const file = createMockFile(json, "test.json");
      const result = await parseInputFile(file);

      expect(result.text).toBe("The content value");
    });
  });
});