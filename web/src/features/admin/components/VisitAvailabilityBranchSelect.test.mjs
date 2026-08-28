import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, "../../..");
const read = (relative) => fs.readFileSync(path.join(srcDir, relative), "utf8");

test("visit availability branch selection component and CSS enforce horizontal flex alignment without stacking", () => {
  const tab = read("features/admin/components/VisitAvailabilityTab.jsx");
  const css = read("features/admin/styles/admin-reservations.css");

  // Tab JSX must include clean flex container for the trigger content
  assert.match(
    tab,
    /className=["']visit-branch-trigger-content["']/,
    "Branch dropdown trigger must use visit-branch-trigger-content"
  );

  // CSS must define .visit-branch-trigger-content with inline-flex and horizontal alignment
  assert.match(
    css,
    /\.visit-branch-trigger-content\s*\{[\s\S]*?display:\s*(?:inline-)?flex;[\s\S]*?align-items:\s*center;/,
    "CSS .visit-branch-trigger-content must have display: flex and align-items: center"
  );

  // CSS trigger must have auto or min-content width rather than narrow fixed width that forces stacking
  assert.doesNotMatch(
    css,
    /\.visit-branch-dropdown-trigger\s*\{[\s\S]*?width:\s*176px;\s*min-width:\s*176px;/,
    "Branch dropdown trigger should not use fixed 176px width that causes icon and text to wrap/stack"
  );

  // When disabled (branch admin), BranchSelectDropdown should present clean assigned branch indicator
  assert.match(
    tab,
    /disabled[\s\S]*?visit-branch-badge|disabled[\s\S]*?!disabled\s*&&\s*\(/,
    "Branch selection should handle disabled/assigned state cleanly without redundant dropdown chevron"
  );
});
