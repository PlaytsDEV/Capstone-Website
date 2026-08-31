import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("RulesSection renders clean static cards without collapsible accordion state", () => {
  const rawCode = fs.readFileSync(
    path.join(__dirname, "RulesSection.jsx"),
    "utf8"
  );

  // Must NOT contain accordion toggle state or ChevronDown collapsible icons
  assert.doesNotMatch(
    rawCode,
    /useState\s*\(\s*(?:0|null|\d+)\s*\)/,
    "RulesSection must not use expandedIndex accordion state"
  );
  assert.doesNotMatch(
    rawCode,
    /ChevronDown/,
    "RulesSection must not import or render ChevronDown accordion toggles"
  );
  assert.doesNotMatch(
    rawCode,
    /maxHeight:\s*isExpanded/,
    "RulesSection must not use collapsible maxHeight styles"
  );

  // Must render responsive grid with equal-height cards
  assert.match(
    rawCode,
    /className="[^"]*grid\s+(?:grid-cols-1\s+)?md:grid-cols-2\s+lg:grid-cols-3\s+gap-[4-6][^"]*"/,
    "RulesSection must render a responsive 3-column grid"
  );

  // Must render top-aligned icon badge and title
  assert.match(
    rawCode,
    /rule\.title/,
    "RulesSection must render rule.title"
  );
  assert.match(
    rawCode,
    /rule\.description/,
    "RulesSection must render rule.description directly without hiding"
  );
});

test("RulesSection enforces solid HSL design tokens, no gradients, and clean 1px borders", () => {
  const rawCode = fs.readFileSync(
    path.join(__dirname, "RulesSection.jsx"),
    "utf8"
  );

  // Strictly no background or text gradients
  assert.doesNotMatch(
    rawCode,
    /bg-gradient|gradient-to/,
    "RulesSection must strictly not use gradients"
  );

  // Must use HSL CSS variable design tokens
  assert.match(
    rawCode,
    /var\(--lp-bg-card\)/,
    "RulesSection must use var(--lp-bg-card) token"
  );
  assert.match(
    rawCode,
    /var\(--lp-border\)/,
    "RulesSection must use var(--lp-border) token"
  );

  // Must use proper Lilycrest terminology (Tenant, not Resident)
  assert.match(
    rawCode,
    /Tenant Rules/,
    "RulesSection header must use 'Tenant Rules'"
  );
  assert.doesNotMatch(
    rawCode,
    /Resident Rules/i,
    "RulesSection must strictly use 'Tenant', never 'Resident'"
  );
});

test("RulesSection uses hardware-accelerated CSS transitions without inline JS hover mutations", () => {
  const rawCode = fs.readFileSync(
    path.join(__dirname, "RulesSection.jsx"),
    "utf8"
  );

  // Must not use inline onMouseEnter or onMouseLeave
  assert.doesNotMatch(
    rawCode,
    /onMouseEnter/,
    "RulesSection must not use onMouseEnter inline DOM style mutations"
  );
  assert.doesNotMatch(
    rawCode,
    /onMouseLeave/,
    "RulesSection must not use onMouseLeave inline DOM style mutations"
  );

  // Must use CSS hover and transition classes
  assert.match(
    rawCode,
    /hover:-translate-y-0\.5|hover:translate-y/,
    "RulesSection cards must use CSS hover translate transform"
  );
  assert.match(
    rawCode,
    /transition-all|transition-transform/,
    "RulesSection cards must use CSS transitions"
  );
});

