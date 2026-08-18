import test from "node:test";
import assert from "node:assert/strict";
import {
  computeAutoColWidths,
  computeKpiColumns,
  sanitizePdfText,
  exportReportPdf,
} from "./reportPdf.js";

test("sanitizePdfText handles peso symbols, unicode arrows, and special characters", () => {
  assert.equal(sanitizePdfText("₱1,500.00"), "PHP 1,500.00");
  assert.equal(sanitizePdfText("Total: ₱ 25,000"), "Total: PHP 25,000");
  assert.equal(sanitizePdfText("Revenue ↑ 15%"), "Revenue + 15%");
  assert.equal(sanitizePdfText("Occupancy ↓ 5%"), "Occupancy - 5%");
  assert.equal(sanitizePdfText("• Item one • Item two"), "- Item one - Item two");
  assert.equal(sanitizePdfText(null), "");
});

test("computeKpiColumns calculates balanced column counts", () => {
  assert.equal(computeKpiColumns(6), 3, "6 KPIs should use a 3x2 grid");
  assert.equal(computeKpiColumns(4), 4, "4 KPIs should use 4 columns");
  assert.equal(computeKpiColumns(3), 3, "3 KPIs should use 3 columns");
  assert.equal(computeKpiColumns(2), 2, "2 KPIs should use 2 columns");
  assert.equal(computeKpiColumns(1), 1, "1 KPI should use 1 column");
  assert.equal(computeKpiColumns(5), 5, "5 KPIs should use 5 columns");
  assert.equal(computeKpiColumns(9), 3, "9 KPIs should use 3 columns");
});

test("computeAutoColWidths normalizes to exact printable width with sensible minimums", () => {
  const headers = ["Code", "Applicant", "Branch", "Room", "Status", "Move In", "Created"];
  const rows = [
    {
      Code: "RES-BZU4VP",
      Applicant: "Rio Mercolita",
      Branch: "Guadalupe",
      Room: "GD - Room 106",
      Status: "Move In",
      "Move In": "2026-08-11",
      Created: "2026-08-12",
    },
  ];

  const widths = computeAutoColWidths(headers, rows, 178);
  assert.equal(widths.length, 7);

  const totalWidth = widths.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(totalWidth - 178) < 0.001, `Total width should be 178, got ${totalWidth}`);

  // Date and Room columns must have ample width (> 20mm) so strings don't wrap awkwardly
  const moveInIndex = headers.indexOf("Move In");
  const createdIndex = headers.indexOf("Created");
  const roomIndex = headers.indexOf("Room");

  assert.ok(widths[moveInIndex] >= 20, `Move In width ${widths[moveInIndex]} should be >= 20mm`);
  assert.ok(widths[createdIndex] >= 20, `Created width ${widths[createdIndex]} should be >= 20mm`);
  assert.ok(widths[roomIndex] >= 22, `Room width ${widths[roomIndex]} should be >= 22mm`);
});

test("exportReportPdf generates multi-page document when table rows exceed page limit", async () => {
  // Generate 45 rows to ensure it triggers multi-page pagination
  const sampleRows = Array.from({ length: 45 }, (_, i) => ({
    Code: `RES-00${i + 1}`,
    Applicant: `Applicant Name ${i + 1}`,
    Branch: i % 2 === 0 ? "Gil Puyat" : "Guadalupe",
    Room: `GP - Room ${200 + i}`,
    Status: i % 3 === 0 ? "Move In" : i % 3 === 1 ? "Pending Payment" : "Cancelled",
    "Move In": "2026-08-11",
    Created: "2026-08-12",
  }));

  const { jsPDF } = await import("jspdf");
  const originalSave = jsPDF.prototype.save;
  jsPDF.prototype.save = function () {};

  try {
    const doc = await exportReportPdf({
      title: "Test Multi-Page Reservations Report",
      subtitle: "Filter Context: All Branches | All Statuses",
      reportType: "Reservations",
      kpis: [
        { label: "TOTAL", value: "45" },
        { label: "PENDING", value: "15" },
        { label: "APPROVED", value: "10" },
        { label: "RESERVED", value: "5" },
        { label: "MOVE IN", value: "10" },
        { label: "CANCELLED", value: "5" },
      ],
      sections: [
        {
          type: "table",
          title: "Filtered Reservations List",
          description: "Export containing 45 reservation records.",
          headers: ["Code", "Applicant", "Branch", "Room", "Status", "Move In", "Created"],
          colWidths: [25, 35, 22, 26, 24, 23, 23],
          rows: sampleRows,
        },
      ],
    });

    assert.ok(doc, "exportReportPdf should return the generated jsPDF doc");
    const numPages = doc.internal.getNumberOfPages();
    assert.ok(numPages >= 2, `Doc with 45 rows should have at least 2 pages, got ${numPages}`);
  } finally {
    jsPDF.prototype.save = originalSave;
  }
});
