import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("Navbar: Sign In CTA must be visible on mobile header (not hidden on mobile viewports)", () => {
  const rawCode = fs.readFileSync(
    path.join(__dirname, "Navbar.js"),
    "utf8"
  );

  // The header Sign In button should NOT be restricted to hidden lg:inline-flex
  assert.doesNotMatch(
    rawCode,
    /<Link\s+to="\/signin"\s+className="hidden lg:inline-flex/,
    "Header Sign In link must not use 'hidden lg:inline-flex' (it must be visible on mobile)"
  );

  // The header Sign In button should be an inline-flex element
  assert.match(
    rawCode,
    /<Link\s+to="\/signin"\s+className="inline-flex/,
    "Header Sign In link must be visible with inline-flex on mobile"
  );
});

test("Navbar: Authenticated initial avatar badge must be visible on mobile header", () => {
  const rawCode = fs.readFileSync(
    path.join(__dirname, "Navbar.js"),
    "utf8"
  );

  // The header avatar link should NOT be restricted to hidden lg:flex
  assert.doesNotMatch(
    rawCode,
    /<Link\s+to=\{profileUrl\}\s+className="hidden lg:flex/,
    "Header authenticated profile link must not use 'hidden lg:flex' (it must be visible on mobile)"
  );

  // The header avatar link must be visible with flex
  assert.match(
    rawCode,
    /<Link\s+to=\{profileUrl\}\s+className="flex items-center justify-center/,
    "Header profile link must use 'flex items-center justify-center' across viewports"
  );
});

test("Navbar: Mobile drawer footer must retain Sign In / Profile action for full accessibility", () => {
  const rawCode = fs.readFileSync(
    path.join(__dirname, "Navbar.js"),
    "utf8"
  );

  // Drawer must still contain the Sign In link
  assert.match(
    rawCode,
    /to="\/signin"[\s\S]*?>\s*Sign In\s*<\/Link>/,
    "Mobile slide-over drawer footer must retain the Sign In link"
  );

  // Drawer must still contain Book Now link
  assert.match(
    rawCode,
    /to="\/applicant\/check-availability"[\s\S]*?>\s*Book Now\s*<\/Link>/,
    "Mobile slide-over drawer footer must retain Book Now CTA"
  );
});
