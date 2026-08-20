import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readTabSource(filename) {
  return readFile(path.join(__dirname, filename), "utf8");
}

test("AnalyticsPage disallows export buttons on overview tab and binds registerTabExport for all other tabs", async () => {
  const source = await readTabSource("AnalyticsPage.jsx");

  // Overview does not provide export handlers
  assert.doesNotMatch(source, /exportOverviewCsv/);
  assert.doesNotMatch(source, /exportOverviewPdf/);
  assert.match(source, /activeTabNormalized === "overview" \? null/);
  assert.match(source, /activeTabNormalized !== "overview"/);

  // Tab export registration is passed down for detailed tabs
  assert.match(source, /const \[tabExports, setTabExports\] = useState\(\{\}\)/);
  assert.match(source, /registerTabExport\(activeTabNormalized,\s*exports\)/);
  assert.match(source, /registerExport:\s*registerCurrentTabExport/);
});

test("AnalyticsOccupancyTab accepts registerExport and defines standardized CSV & PDF export handlers", async () => {
  const source = await readTabSource("AnalyticsOccupancyTab.jsx");

  assert.match(source, /registerExport/);
  assert.match(source, /handleCsvExport\(\s*filteredInventory,\s*\[/);
  assert.match(source, /lilycrest-occupancy-/);
  assert.match(source, /handlePdfExport\(\{/);
  assert.match(source, /registerExport\(\{\s*exportCsv,\s*exportPdf\s*\}\)/);
});

test("AnalyticsBillingTab accepts registerExport and defines standardized CSV & PDF export handlers", async () => {
  const source = await readTabSource("AnalyticsBillingTab.jsx");

  assert.match(source, /registerExport/);
  assert.match(source, /lilycrest-billing-/);
  assert.match(source, /registerExport\(\{\s*exportCsv,\s*exportPdf\s*\}\)/);
});

test("AnalyticsOperationsTab accepts registerExport and defines standardized CSV & PDF export handlers", async () => {
  const source = await readTabSource("AnalyticsOperationsTab.jsx");

  assert.match(source, /registerExport/);
  assert.match(source, /lilycrest-operations-/);
  assert.match(source, /registerExport\(\{\s*exportCsv,\s*exportPdf\s*\}\)/);
});

test("AnalyticsDemographicsTab accepts registerExport and defines standardized CSV & PDF export handlers", async () => {
  const source = await readTabSource("AnalyticsDemographicsTab.jsx");

  assert.match(source, /registerExport/);
  assert.match(source, /lilycrest-demographics-/);
  assert.match(source, /registerExport\(\{\s*exportCsv,\s*exportPdf\s*\}\)/);
});

test("AnalyticsAcquisitionTab accepts registerExport and defines standardized CSV & PDF export handlers", async () => {
  const source = await readTabSource("AnalyticsAcquisitionTab.jsx");

  assert.match(source, /registerExport/);
  assert.match(source, /lilycrest-acquisition-/);
  assert.match(source, /registerExport\(\{\s*exportCsv,\s*exportPdf\s*\}\)/);
});

test("AnalyticsConsolidatedTab accepts registerExport and defines standardized CSV & PDF export handlers", async () => {
  const source = await readTabSource("AnalyticsConsolidatedTab.jsx");

  assert.match(source, /registerExport/);
  assert.match(source, /lilycrest-consolidated-/);
  assert.match(source, /registerExport\(\{\s*exportCsv,\s*exportPdf\s*\}\)/);
});

test("AnalyticsFinancialsTab accepts registerExport and defines standardized CSV & PDF export handlers", async () => {
  const source = await readTabSource("AnalyticsFinancialsTab.jsx");

  assert.match(source, /registerExport/);
  assert.match(source, /lilycrest-financials-/);
  assert.match(source, /registerExport\(\{\s*exportCsv,\s*exportPdf\s*\}\)/);
});

test("AnalyticsMonitoringTab accepts registerExport and defines standardized CSV & PDF export handlers", async () => {
  const source = await readTabSource("AnalyticsMonitoringTab.jsx");

  assert.match(source, /registerExport/);
  assert.match(source, /lilycrest-monitoring-/);
  assert.match(source, /registerExport\(\{\s*exportCsv,\s*exportPdf\s*\}\)/);
});
