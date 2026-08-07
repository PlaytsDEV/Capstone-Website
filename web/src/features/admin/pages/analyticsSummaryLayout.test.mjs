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

test("analytics summary keeps a KPI-plus-chart overview structure", async () => {
  const source = await readSource("AnalyticsPage.jsx");

  assert.match(source, /className="analytics-container"/);
  assert.match(source, /className="analytics-layout"/);
  assert.match(source, /className="analytics-topbar"/);
  assert.match(source, /className="analytics-main"/);
  assert.match(source, /activeTab === "overview"/);
  assert.match(source, /activeTab === "occupancy"/);
  assert.match(source, /activeTab === "revenue"/);
  assert.match(source, /activeTab === "operations"/);
});

test("analytics summary no longer renders the legacy stacked summary section helper", async () => {
  const source = await readSource("AnalyticsPage.jsx");

  assert.doesNotMatch(source, /function SummarySection\s*\(/);
  assert.doesNotMatch(source, /function SummarySignalGrid/);
  assert.doesNotMatch(source, /function SummaryOverviewSignal/);
  assert.doesNotMatch(source, /function OwnerShortcutLink/);
  assert.doesNotMatch(source, /<SummarySection\s/);
  assert.doesNotMatch(source, /analytics-summary-focus__mobile-nav/);
  assert.doesNotMatch(source, /deckRef/);
  assert.doesNotMatch(source, /activeDeckIndex/);
  assert.doesNotMatch(source, /data-summary-owner-shortcuts="true"/);
});

test("analytics summary opts into topbar and layout controls", async () => {
  const source = await readSource("AnalyticsPage.jsx");

  assert.match(source, /className="analytics-topbar"/);
  assert.match(source, /className="analytics-filter-row"/);
  assert.match(source, /className="analytics-select"/);
});

test("analytics exposes permission-aware Feedback & Surveys navigation tab", async () => {
  const source = await readSource("AnalyticsPage.jsx");

  assert.match(source, /can\("viewSurveyAnalytics"\)/);
  assert.match(source, /handleTabChange\("surveys"\)/);
  assert.match(source, /<SurveyAnalyticsTab \/>/);
  assert.match(source, /Feedback &amp; Surveys/g);
});

test("analytics summary uses default page scrolling instead of an inner chart scroller", async () => {
  const styles = await readSource(path.join("..", "styles", "admin-reports.css"));
  const layoutStyles = await readSource(path.join("..", "styles", "admin-layout.css"));
  const layoutSource = await readSource(
    path.join("..", "components", "AdminLayout.jsx"),
  );

  assert.match(
    styles,
    /\.analytics-summary-layout__body\s*\{[\s\S]*align-items:\s*stretch;/,
  );
  assert.doesNotMatch(
    styles,
    /\.analytics-summary-layout__main\s*>\s*\.analytics-summary-focus\s*\{[\s\S]*overflow-y:\s*auto;/,
  );
  assert.doesNotMatch(
    styles,
    /@media \(min-width: 1025px\)\s*\{[\s\S]*\.analytics-summary-overview\s*\{[\s\S]*min-height:\s*100%;/,
  );
  assert.doesNotMatch(layoutStyles, /\.admin-content--viewport-locked\s*\{/);
  assert.doesNotMatch(layoutSource, /admin-content--viewport-locked/);
  assert.doesNotMatch(layoutSource, /admin-layout--analytics-summary/);
});
