import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { chromium } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.resolve(here, "..", "..", ".codex-run-logs", "email-visual-qa");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found at ${chromePath}`);

const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const cases = [
  { file: "branch-gil-puyat.html", name: "gil-puyat-desktop", width: 1200, height: 900 },
  { file: "branch-guadalupe.html", name: "guadalupe-mobile", width: 390, height: 844 },
  { file: "branch-unassigned.html", name: "unassigned-mobile", width: 390, height: 844 },
  { file: "inquiry_response.html", name: "inquiry-mobile", width: 390, height: 844 },
];

const screenshots = [];
for (const item of cases) {
  const context = await browser.newContext({ viewport: { width: item.width, height: item.height } });
  const page = await context.newPage();
  await page.goto(pathToFileURL(path.join(fixtureDir, item.file)).href, { waitUntil: "networkidle" });
  const output = path.join(fixtureDir, `${item.name}.png`);
  await page.screenshot({ path: output, fullPage: true });
  screenshots.push(output);
  await context.close();
}

await browser.close();
console.log(JSON.stringify(screenshots, null, 2));
