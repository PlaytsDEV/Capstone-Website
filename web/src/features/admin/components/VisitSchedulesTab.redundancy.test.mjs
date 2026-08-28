import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readVisitSchedulesSource() {
  return readFile(path.join(__dirname, "VisitSchedulesTab.jsx"), "utf8");
}

test("VisitSchedulesTab does not render redundant inline Cancelled badge in visitor name cell", async () => {
  const source = await readVisitSchedulesSource();

  // Must not have inline historyStatus === 'cancelled' tag next to row.customer
  assert.doesNotMatch(
    source,
    /row\.historyStatus\s*===\s*["']cancelled["']\s*\?\s*\(\s*<span[^>]*>[\s\S]*?Cancelled[\s\S]*?<\/span>\s*\)/,
    "Found redundant inline Cancelled badge in visitor name cell",
  );

  // Must not use error-light status badges inside the visitor column
  assert.doesNotMatch(
    source,
    /bg-error-light px-2 py-0.5 text-\[10px\] font-semibold text-error-dark/,
    "Found old error status badge class in visitor cell",
  );
});

test("VisitSchedulesTab restricts attempt badges to multi-attempt visits only (>1) with neutral tokens", async () => {
  const source = await readVisitSchedulesSource();

  // Attempt badge must check for attemptNumber > 1 (not showing on attempt 1)
  assert.match(
    source,
    /row\.attemptNumber\s*&&\s*row\.attemptNumber\s*>\s*1|row\.attemptNumber\s*>\s*1/,
    "Attempt badge must only be shown when attemptNumber > 1",
  );

  // Attempt badge must use neutral styling tokens
  assert.match(
    source,
    /border-border\s+bg-muted\/50\s+text-muted-foreground|border-border\s+bg-muted/,
    "Attempt badge must use neutral design tokens without bright colors",
  );
});

test("VisitSchedulesTab preserves StatusBadge in dedicated Status column as single source of truth", async () => {
  const source = await readVisitSchedulesSource();

  // Status column must use StatusBadge
  assert.match(
    source,
    /<StatusBadge\s+module=["']visit["']\s+status=\{config\.status\}\s+label=\{config\.label\}\s*\/>/,
    "StatusBadge must remain the single source of truth in Status column",
  );
});
