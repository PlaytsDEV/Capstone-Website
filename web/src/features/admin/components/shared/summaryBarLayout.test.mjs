import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readSource(fileName) {
  return readFile(path.join(__dirname, fileName), "utf8");
}

test("SummaryBar provides a 5-column grid layout for 5 items without trailing empty space", async () => {
  const source = await readSource("SummaryBar.jsx");

  assert.match(source, /5:\s*"grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"/);
  assert.match(source, /GRID_COLUMNS_BY_COUNT/);
});

test("SummaryBar supports full semantic color tokens including amber, emerald, rose, and violet", async () => {
  const source = await readSource("SummaryBar.jsx");

  assert.match(source, /amber:\s*\{/);
  assert.match(source, /emerald:\s*\{/);
  assert.match(source, /rose:\s*\{/);
  assert.match(source, /violet:\s*\{/);
  assert.match(source, /indigo:\s*\{/);
  assert.match(source, /teal:\s*\{/);
});

test("SummaryBar enforces accessible interactive card semantics and keyboard navigation", async () => {
  const source = await readSource("SummaryBar.jsx");

  assert.match(source, /role=\{isClickable \? "button" : "listitem"\}/);
  assert.match(source, /aria-pressed=\{isClickable \? isActive : undefined\}/);
  assert.match(source, /tabIndex=\{isClickable \? 0 : undefined\}/);
  assert.match(source, /tabular-nums/);
});

test("MaintenanceSummaryCards renders SummaryBar with summary items and stage filter props", async () => {
  const source = await readFile(
    path.join(__dirname, "..", "..", "pages", "maintenance", "components", "MaintenanceSummaryCards.jsx"),
    "utf8",
  );

  assert.match(source, /<SummaryBar/);
  assert.match(source, /items=\{summaryItems\}/);
  assert.match(source, /onItemClick=\{onItemClick\}/);
  assert.match(source, /activeIndex=\{activeIndex\}/);
});

test("MaintenanceFilters renders consolidated 4-core toolbar with stage/status dropdowns and live counts", async () => {
  const source = await readFile(
    path.join(__dirname, "..", "..", "pages", "maintenance", "components", "MaintenanceFilters.jsx"),
    "utf8",
  );

  assert.match(source, /OPERATIONAL_STAGES/);
  assert.match(source, /SPECIFIC_STATUS_OPTIONS/);
  assert.match(source, /Filter by operational stage/);
  assert.match(source, /Filter by specific status/);
  assert.match(source, /stageCounts|stageStatusCounts|statusCounts/);
  assert.match(source, /urgencyCounts/);
  assert.match(source, /branchCounts/);
});

test("maintenanceUtils provides matchesStageOrStatus and getStageStatusLabel helpers", async () => {
  const source = await readFile(
    path.join(__dirname, "..", "..", "pages", "maintenance", "maintenanceUtils.js"),
    "utf8",
  );

  assert.match(source, /export const OPERATIONAL_STAGES =/);
  assert.match(source, /export const SPECIFIC_STATUS_OPTIONS =/);
  assert.match(source, /export const getStageStatusLabel =/);
  assert.match(source, /export const matchesStageOrStatus =/);
});


