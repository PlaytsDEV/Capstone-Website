import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatMaintenanceVoucherData } from "./maintenanceVoucherPdf.js";

describe("maintenanceVoucherPdf formatting", () => {
  it("formats single maintenance request into complete voucher structure", () => {
    const mockRequest = {
      request_id: "REQ-9988",
      request_type: "electrical",
      status: "completed",
      urgency: "urgent",
      branch: "main",
      room: "Room 102",
      user: { name: "Maria Santos", email: "maria@example.com" },
      created_at: "2026-08-01T10:00:00.000Z",
      resolved_at: "2026-08-02T14:00:00.000Z",
      closed_at: "2026-08-02T14:00:00.000Z",
      assignedProviderName: "Sparky Electrical Co.",
      costBreakdown: { laborCost: 750, materialsCost: 400, isTenantChargeable: false },
      resolutionConfirmation: { rating: 5, tenantFeedback: "Quick and polite service." },
      notes: "Replaced faulty circuit breaker in panel.",
      completionReport: { summary: "Circuit breaker replaced and verified." },
    };

    const data = formatMaintenanceVoucherData(mockRequest);
    assert.equal(data.requestId, "#REQ-9988");
    assert.equal(data.tenantName, "Maria Santos");
    assert.equal(data.totalCostFormatted, "PHP 1,150.00");
    assert.equal(data.laborCostFormatted, "PHP 750.00");
    assert.equal(data.materialsCostFormatted, "PHP 400.00");
    assert.equal(data.attributionLabel, "Property Expense");
    assert.equal(data.kpis.length, 4);
    assert.equal(data.summaryNarrative, "Circuit breaker replaced and verified.");
  });

  it("handles null request gracefully", () => {
    assert.equal(formatMaintenanceVoucherData(null), null);
  });

  it("extracts request from both direct and wrapped parameter objects", () => {
    const mockRequest = { request_id: "REQ-123" };
    const directExtract = (param) => (param?.request ? param.request : param);
    
    assert.equal(directExtract(mockRequest).request_id, "REQ-123");
    assert.equal(directExtract({ request: mockRequest }).request_id, "REQ-123");
    assert.equal(directExtract(null), null);
  });
});
