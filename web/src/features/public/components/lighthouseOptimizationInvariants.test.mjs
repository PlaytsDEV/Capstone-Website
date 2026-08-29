import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, "../../../..");

test("Agentic Browsing: llms.txt must have H1 header, overview blockquote, and markdown links", () => {
  const llmsPath = path.join(webDir, "public", "llms.txt");
  assert.ok(fs.existsSync(llmsPath), "public/llms.txt must exist");

  const content = fs.readFileSync(llmsPath, "utf8");
  assert.match(content, /^#\s+Lilycrest/m, "llms.txt must start with an H1 header");
  assert.match(content, /^>\s+.+/m, "llms.txt must have a blockquote overview");
  assert.match(content, /\[.+?\]\(https?:\/\/.+?\)/, "llms.txt must contain markdown links");
  assert.match(content, /\/applicant\/check-availability/, "llms.txt must link to check availability");
});

test("Agentic Browsing: llms-full.txt must have expanded room rates, branches, and amenities", () => {
  const fullPath = path.join(webDir, "public", "llms-full.txt");
  assert.ok(fs.existsSync(fullPath), "public/llms-full.txt must exist");

  const content = fs.readFileSync(fullPath, "utf8");
  assert.match(content, /^#\s+Lilycrest/m, "llms-full.txt must start with an H1 header");
  assert.match(content, /Gil Puyat/i, "llms-full.txt must mention Gil Puyat branch");
  assert.match(content, /Guadalupe/i, "llms-full.txt must mention Guadalupe branch");
  assert.match(content, /₱/, "llms-full.txt must specify room rates");
});

test("Best Practices: vite.config.js must configure hidden sourcemaps and isolated vendor chunks", () => {
  const viteConfigPath = path.join(webDir, "vite.config.js");
  const configContent = fs.readFileSync(viteConfigPath, "utf8");

  assert.match(
    configContent,
    /sourcemap:\s*["']hidden["']/,
    "vite.config.js must set sourcemap to 'hidden' for Lighthouse Best Practices"
  );
  assert.match(
    configContent,
    /"vendor-pdf":\s*\[/,
    "vite.config.js must define isolated vendor-pdf chunk for jsPDF/html2canvas"
  );
  assert.match(
    configContent,
    /"vendor-motion":\s*\[/,
    "vite.config.js must define isolated vendor-motion chunk for framer-motion"
  );
});

test("Caching & Performance: vercel.json must configure immutable asset caching and metadata caching", () => {
  const vercelPath = path.join(webDir, "vercel.json");
  const rawVercel = fs.readFileSync(vercelPath, "utf8");
  const vercelConfig = JSON.parse(rawVercel);

  const assetHeaderRule = vercelConfig.headers?.find(
    (h) => h.source === "/assets/(.*)"
  );
  assert.ok(assetHeaderRule, "vercel.json must have a header rule for /assets/(.*)");

  const assetCacheHeader = assetHeaderRule.headers.find(
    (h) => h.key === "Cache-Control"
  );
  assert.ok(assetCacheHeader, "/assets/(.*) must have Cache-Control header");
  assert.match(
    assetCacheHeader.value,
    /max-age=31536000/,
    "/assets/(.*) Cache-Control must specify 1 year (max-age=31536000)"
  );
  assert.match(
    assetCacheHeader.value,
    /immutable/,
    "/assets/(.*) Cache-Control must be immutable"
  );

  const metadataRule = vercelConfig.headers?.find((h) =>
    h.source?.includes("llms")
  );
  assert.ok(
    metadataRule,
    "vercel.json must include a caching header rule for metadata files (llms.txt, robots.txt, etc.)"
  );
});

test("Accessibility: HeroSection must use high-contrast gold text token and WCAG AA contrast colors", () => {
  const heroPath = path.join(
    webDir,
    "src",
    "features",
    "public",
    "components",
    "HeroSection.jsx"
  );
  const heroContent = fs.readFileSync(heroPath, "utf8");

  assert.match(
    heroContent,
    /var\(--lp-accent-text\)/,
    "HeroSection must use var(--lp-accent-text) for gold text contrast"
  );
});

test("Performance: PublicChatbotLauncher must use IntersectionObserver instead of scroll getBoundingClientRect", () => {
  const launcherPath = path.join(
    webDir,
    "src",
    "features",
    "public",
    "components",
    "chatbot",
    "PublicChatbotLauncher.jsx"
  );
  const launcherContent = fs.readFileSync(launcherPath, "utf8");

  assert.match(
    launcherContent,
    /IntersectionObserver/,
    "PublicChatbotLauncher must use IntersectionObserver to avoid forced reflows"
  );
  assert.doesNotMatch(
    launcherContent,
    /window\.addEventListener\(["']scroll["']/,
    "PublicChatbotLauncher must not attach layout-measuring scroll event listeners"
  );
});
