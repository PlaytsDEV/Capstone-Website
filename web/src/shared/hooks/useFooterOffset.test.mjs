import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("useFooterOffset hook exists, handles lazy footers via MutationObserver, and calculates offset with IntersectionObserver", () => {
  const hookFile = path.join(__dirname, "useFooterOffset.js");
  assert.ok(fs.existsSync(hookFile), "useFooterOffset.js must exist");

  const rawCode = fs.readFileSync(hookFile, "utf8");

  // Must export useFooterOffset
  assert.match(
    rawCode,
    /export\s+(?:default\s+function|function)\s+useFooterOffset/,
    "useFooterOffset must be exported"
  );

  // Must use MutationObserver to support React.lazy/Suspense footer mounting
  assert.match(
    rawCode,
    /MutationObserver/,
    "useFooterOffset must use MutationObserver to detect lazy-loaded footer mounting"
  );

  // Must use IntersectionObserver to prevent forced reflows and layout thrashing
  assert.match(
    rawCode,
    /IntersectionObserver/,
    "useFooterOffset must use IntersectionObserver for smooth performance without reflows"
  );

  // Must not attach scroll event listeners
  assert.doesNotMatch(
    rawCode,
    /addEventListener\(\s*["']scroll["']/,
    "useFooterOffset must not attach scroll event listeners"
  );
});

test("PublicChatbotLauncher and ScrollToTopButton import and integrate useFooterOffset", () => {
  const chatbotFile = path.resolve(__dirname, "../../features/public/components/chatbot/PublicChatbotLauncher.jsx");
  const scrollTopFile = path.resolve(__dirname, "../components/ScrollToTopButton.jsx");

  assert.ok(fs.existsSync(chatbotFile), "PublicChatbotLauncher.jsx must exist");
  assert.ok(fs.existsSync(scrollTopFile), "ScrollToTopButton.jsx must exist");

  const chatbotCode = fs.readFileSync(chatbotFile, "utf8");
  const scrollTopCode = fs.readFileSync(scrollTopFile, "utf8");

  // Chatbot launcher integration
  assert.match(
    chatbotCode,
    /useFooterOffset/,
    "PublicChatbotLauncher must use useFooterOffset hook"
  );

  // Scroll to top integration
  assert.match(
    scrollTopCode,
    /useFooterOffset/,
    "ScrollToTopButton must use useFooterOffset hook"
  );
});

test("useFooterOffset attaches passive resize event listener and supports safe locationOverride", () => {
  const hookFile = path.join(__dirname, "useFooterOffset.js");
  const rawCode = fs.readFileSync(hookFile, "utf8");

  // Must attach window resize listener with passive flag
  assert.match(
    rawCode,
    /addEventListener\(\s*["']resize["'],\s*\w+,\s*\{\s*passive:\s*true\s*\}\)/,
    "useFooterOffset must attach passive resize event listener"
  );

  // Must remove window resize listener on cleanup
  assert.match(
    rawCode,
    /removeEventListener\(\s*["']resize["']/,
    "useFooterOffset must clean up window resize listener"
  );

  // Must support locationOverride parameter
  assert.match(
    rawCode,
    /locationOverride/,
    "useFooterOffset must support locationOverride parameter for isolated testing"
  );
});

