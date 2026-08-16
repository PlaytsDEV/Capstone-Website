import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTRACT_CSV_COLUMNS,
  formatContractsForCSV,
} from "./contractExportUtils.js";

test("CONTRACT_CSV_COLUMNS has required headers", () => {
  assert.ok(CONTRACT_CSV_COLUMNS.length >= 8);
  const keys = CONTRACT_CSV_COLUMNS.map((col) => col.key);
  assert.ok(keys.includes("contractNumber"));
  assert.ok(keys.includes("tenantLegalName"));
  assert.ok(keys.includes("branch"));
  assert.ok(keys.includes("status"));
});

test("formatContractsForCSV handles contract array safely", () => {
  const sample = [
    {
      contractNumber: "LIL-2026-001",
      tenantLegalName: "Juan Dela Cruz",
      branch: "guadalupe",
      roomNumber: "GP-803",
      bedLabel: "Bed 1",
      status: "signed",
      durationMonths: 12,
      monthlyRate: 13500,
      startDate: "2026-08-01",
      endDate: "2027-08-01",
      createdAt: "2026-07-20",
    },
    {
      contractNumber: null,
      tenantLegalName: null,
      status: "draft",
    },
  ];

  const formatted = formatContractsForCSV(sample);
  assert.equal(formatted.length, 2);
  assert.equal(formatted[0].contractNumber, "LIL-2026-001");
  assert.equal(formatted[0].tenantLegalName, "Juan Dela Cruz");
  assert.equal(formatted[0].status, "Pending Notarization");
  assert.equal(formatted[1].contractNumber, "Pending");
  assert.equal(formatted[1].tenantLegalName, "Unknown");
  assert.equal(formatted[1].status, "Needs Attention");
});
