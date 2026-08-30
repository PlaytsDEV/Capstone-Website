import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, "../../../");

describe("Vite Bundle Chunk Splitting Configuration", () => {
  test("vite.config.js defines isolated manual chunks for heavy vendor dependencies", () => {
    const viteConfigContent = fs.readFileSync(path.join(webDir, "vite.config.js"), "utf-8");
    assert.match(
      viteConfigContent,
      /manualChunks\s*:\s*\{/,
      "vite.config.js must specify manualChunks."
    );
    assert.match(
      viteConfigContent,
      /"vendor-firebase"|'vendor-firebase'/,
      "vite.config.js must isolate Firebase in its own chunk."
    );
    assert.match(
      viteConfigContent,
      /"vendor-charts"|'vendor-charts'/,
      "vite.config.js must isolate charts in its own chunk."
    );
    assert.match(
      viteConfigContent,
      /"vendor-pdf"|'vendor-pdf'/,
      "vite.config.js must isolate PDF tools in its own chunk."
    );
  });
});
