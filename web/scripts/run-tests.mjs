import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const srcDir = path.join(rootDir, "src");

function findTestFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTestFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".test.mjs")) {
      results.push(fullPath);
    }
  }
  return results;
}

const testFiles = findTestFiles(srcDir).sort();

if (testFiles.length === 0) {
  console.error("No *.test.mjs files found under web/src.");
  process.exit(1);
}

console.log(`Running ${testFiles.length} test file(s)...`);

const child = spawn(
  process.execPath,
  ["--test", "--test-reporter=spec", ...testFiles],
  { stdio: "inherit" },
);

child.on("exit", (code) => process.exit(code ?? 1));
