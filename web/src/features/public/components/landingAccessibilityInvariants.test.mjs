import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("Navbar enforces valid aria-current='page' for active navigation items", () => {
  const rawCode = fs.readFileSync(
    path.join(__dirname, "Navbar.js"),
    "utf8"
  );

  // aria-current must use "page", never invalid "true" token
  assert.match(
    rawCode,
    /aria-current=\{isActive \? "page" : undefined\}/,
    "Navbar must set aria-current='page' for active nav link"
  );
  assert.doesNotMatch(
    rawCode,
    /aria-current=\{isActive \? "true" : undefined\}/,
    "Navbar must not use invalid aria-current='true'"
  );
});

test("FAQCategoryTabs enforces button filter semantics with no dangling aria-controls and high-contrast badge token", () => {
  const rawCode = fs.readFileSync(
    path.join(__dirname, "faq/FAQCategoryTabs.jsx"),
    "utf8"
  );

  // Must not have dangling aria-controls
  assert.doesNotMatch(
    rawCode,
    /aria-controls=\{`faq-panel-\$\{cat\.id\}`\}/,
    "FAQCategoryTabs must not reference non-existent tabpanel IDs"
  );

  // Must use aria-pressed for filter button state
  assert.match(
    rawCode,
    /aria-pressed=\{isActive\}/,
    "FAQCategoryTabs must use aria-pressed for filter state"
  );

  // Must use high-contrast gold token for count badges
  assert.match(
    rawCode,
    /var\(--lp-accent-text,\s*#8C6200\)/,
    "FAQCategoryTabs must use accessible --lp-accent-text token on count badges"
  );
});

test("FAQSection enforces W3C Accordion pattern with h3 heading wrappers and region bindings", () => {
  const rawCode = fs.readFileSync(
    path.join(__dirname, "faq/FAQSection.jsx"),
    "utf8"
  );

  // Questions must be wrapped in <h3> headings
  assert.match(
    rawCode,
    /<h3[^>]*>\s*<button[\s\S]*?id=\{`faq-question-\$\{faq\.id\}`\}[\s\S]*?aria-expanded=\{isExpanded\}[\s\S]*?aria-controls=\{`faq-answer-\$\{faq\.id\}`\}/,
    "FAQSection questions must be wrapped in <h3> headings with explicit button IDs and ARIA bindings"
  );

  // Answers must have role="region" and aria-labelledby
  assert.match(
    rawCode,
    /<div[\s\S]*?id=\{`faq-answer-\$\{faq\.id\}`\}[\s\S]*?role="region"[\s\S]*?aria-labelledby=\{`faq-question-\$\{faq\.id\}`\}/,
    "FAQSection answer panels must specify role='region' and aria-labelledby"
  );

  // Closed accordion chevron icon must use high contrast text token
  assert.match(
    rawCode,
    /var\(--lp-accent-text,\s*#8C6200\)/,
    "FAQSection must use --lp-accent-text for closed accordion icon"
  );
});

test("ContactFooter enforces sequential heading outline with sr-only h2 and h3 column headers", () => {
  const rawCode = fs.readFileSync(
    path.join(__dirname, "ContactFooter.jsx"),
    "utf8"
  );

  // Must have an off-screen h2 for sequential navigation
  assert.match(
    rawCode,
    /<h2 className="sr-only">Contact and Site Navigation<\/h2>/,
    "ContactFooter must include an off-screen <h2> to maintain strict h1->h2->h3 heading flow"
  );

  // Columns must use <h3> rather than <h4>
  assert.match(
    rawCode,
    /<h3[^>]*>\s*Navigation\s*<\/h3>/,
    "Navigation column header must be <h3>"
  );
  assert.match(
    rawCode,
    /<h3[^>]*>\s*Locations\s*<\/h3>/,
    "Locations column header must be <h3>"
  );
  assert.match(
    rawCode,
    /<h3[^>]*>\s*Get in Touch\s*<\/h3>/,
    "Get in Touch column header must be <h3>"
  );
});

test("InquiryForm enforces WCAG AA contrast for prefix, counter, and explicit aria-invalid boolean values", () => {
  const rawCode = fs.readFileSync(
    path.join(__dirname, "InquiryForm.jsx"),
    "utf8"
  );

  // Prefix must be text-slate-700 (4.6:1+ contrast on white)
  assert.match(
    rawCode,
    /text-slate-700 dark:text-slate-300/,
    "Phone prefix must use high-contrast text-slate-700"
  );

  // Counter must be text-slate-600
  assert.match(
    rawCode,
    /text-slate-600 dark:text-slate-400/,
    "Character counter must use high-contrast text-slate-600"
  );

  // aria-invalid must be string 'true' or 'false'
  assert.match(
    rawCode,
    /aria-invalid=\{hasError \? "true" : "false"\}/,
    "Form inputs must specify explicit string true/false for aria-invalid"
  );
});
