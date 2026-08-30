import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, "../../../");

describe("Font & HTML Head Performance Optimization", () => {
  test("index.html does not contain broken dev-path image preloads", () => {
    const htmlContent = fs.readFileSync(path.join(webDir, "index.html"), "utf-8");
    assert.strictEqual(
      htmlContent.includes("/src/assets/images/hero1.webp"),
      false,
      "index.html must not preload hardcoded /src paths which 404 in production."
    );
  });

  test("index.html loads fonts with display=swap for non-blocking rendering", () => {
    const htmlContent = fs.readFileSync(path.join(webDir, "index.html"), "utf-8");
    assert.match(
      htmlContent,
      /fonts\.googleapis\.com\/css2\?[^"']*display=swap/,
      "Google Fonts link must explicitly specify display=swap parameter."
    );
  });

  test("index.css specifies font-display: swap for Plus Jakarta Sans", () => {
    const cssContent = fs.readFileSync(path.join(webDir, "src/index.css"), "utf-8");
    assert.match(
      cssContent,
      /font-display:\s*swap/i,
      "index.css must define font-display: swap for seamless non-blocking text rendering."
    );
  });
});
