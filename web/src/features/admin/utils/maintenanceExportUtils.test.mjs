import test from "node:test";
import assert from "node:assert/strict";
import {
  MAINTENANCE_CSV_COLUMNS,
  formatDate,
  formatDateTime,
  formatCurrencyAmount,
  formatMaintenanceBranchLabel,
  resolveTenantFullName,
  resolveTenantPhone,
  resolveTenantEmail,
  resolveRoomUnitLabel,
  resolveOperationalStage,
  resolveAssignedProviderName,
  resolveAssignedProviderContact,
  resolveTotalRepairCost,
  resolveCostAttribution,
  resolveSlaStateLabel,
  formatMaintenanceForCSV,
  sanitizeSlug,
} from "./maintenanceExportUtils.js";

test("MAINTENANCE_CSV_COLUMNS has all required standard fields", () => {
  assert.ok(MAINTENANCE_CSV_COLUMNS.length >= 15);
  const keys = MAINTENANCE_CSV_COLUMNS.map((col) => col.key);
  assert.ok(keys.includes("requestId"));
  assert.ok(keys.includes("tenantName"));
  assert.ok(keys.includes("tenantPhone"));
  assert.ok(keys.includes("tenantEmail"));
  assert.ok(keys.includes("branch"));
  assert.ok(keys.includes("room"));
  assert.ok(keys.includes("requestType"));
  assert.ok(keys.includes("urgency"));
  assert.ok(keys.includes("stage"));
  assert.ok(keys.includes("status"));
  assert.ok(keys.includes("assignedProvider"));
  assert.ok(keys.includes("providerContact"));
  assert.ok(keys.includes("actualCost"));
  assert.ok(keys.includes("costAttribution"));
  assert.ok(keys.includes("slaState"));
  assert.ok(keys.includes("description"));
  assert.ok(keys.includes("submittedAt"));
});

test("formatDate and formatDateTime handle valid and fallback values", () => {
  assert.equal(formatDate("2026-08-16T08:00:00.000Z"), "2026-08-16");
  assert.equal(formatDate(null), "—");
  assert.equal(formatDate("invalid-date"), "—");

  assert.equal(formatDateTime(null), "—");
  assert.equal(formatDateTime("invalid-date"), "—");
});

test("formatCurrencyAmount formats numbers with 2 decimals", () => {
  assert.equal(formatCurrencyAmount(1500), "1,500.00");
  assert.equal(formatCurrencyAmount("2450.5"), "2,450.50");
  assert.equal(formatCurrencyAmount(0), "0.00");
  assert.equal(formatCurrencyAmount(null), "0.00");
});

test("formatMaintenanceBranchLabel returns human-readable branch names", () => {
  assert.equal(formatMaintenanceBranchLabel("gil-puyat"), "Gil Puyat");
  assert.equal(formatMaintenanceBranchLabel("guadalupe"), "Guadalupe");
  assert.equal(formatMaintenanceBranchLabel(""), "Unassigned");
  assert.equal(formatMaintenanceBranchLabel(null), "Unassigned");
});

test("resolveTenantFullName handles polymorphic tenant shapes", () => {
  assert.equal(resolveTenantFullName({ tenant: { full_name: "Juan Dela Cruz" } }), "Juan Dela Cruz");
  assert.equal(resolveTenantFullName({ tenant: { fullName: "Maria Clara" } }), "Maria Clara");
  assert.equal(resolveTenantFullName({ tenant: { firstName: "Pedro", lastName: "Penduko" } }), "Pedro Penduko");
  assert.equal(resolveTenantFullName({ tenantName: "Crisostomo Ibarra" }), "Crisostomo Ibarra");
  assert.equal(resolveTenantFullName({ user: { fullName: "Elias Salome" } }), "Elias Salome");
  assert.equal(resolveTenantFullName({}), "Resident");
});

test("resolveRoomUnitLabel handles room and bed combinations", () => {
  assert.equal(resolveRoomUnitLabel({ room: "Room 302", bedLabel: "Bed A" }), "Room 302 (Bed A)");
  assert.equal(resolveRoomUnitLabel({ roomNumber: "Room 101" }), "Room 101");
  assert.equal(resolveRoomUnitLabel({ occupancyContext: { unitNumber: "Unit 4B", bedNumber: "2" } }), "Unit 4B (2)");
  assert.equal(resolveRoomUnitLabel({ bed: "Bed B" }), "Bed Bed B");
  assert.equal(resolveRoomUnitLabel({}), "—");
});

test("resolveOperationalStage maps statuses accurately", () => {
  assert.equal(resolveOperationalStage("pending"), "Active Queue");
  assert.equal(resolveOperationalStage("viewed"), "Active Queue");
  assert.equal(resolveOperationalStage("assigned"), "Active Queue");
  assert.equal(resolveOperationalStage("in_progress"), "In Progress");
  assert.equal(resolveOperationalStage("scheduled"), "In Progress");
  assert.equal(resolveOperationalStage("reopened"), "Needs Attention");
  assert.equal(resolveOperationalStage("resolved"), "Resolved (Awaiting)");
  assert.equal(resolveOperationalStage("completed"), "Completed");
});

test("resolveCostAttribution identifies tenant chargeable vs property expense", () => {
  assert.equal(resolveCostAttribution({ costBreakdown: { isTenantChargeable: true, totalCost: 500 } }), "Tenant Chargeable");
  assert.equal(resolveCostAttribution({ costBreakdown: { isTenantChargeable: false, totalCost: 1200 } }), "Property Expense");
  assert.equal(resolveCostAttribution({ actualCost: 350 }), "Property Expense");
  assert.equal(resolveCostAttribution({}), "None");
});

test("formatMaintenanceForCSV transforms records accurately", () => {
  const sampleRequests = [
    {
      request_id: "MNT-00101",
      tenant: {
        full_name: "Juan Dela Cruz",
        phone: "09171234567",
        email: "juan@example.com",
      },
      branch: "gil-puyat",
      room: "Room 201",
      bedLabel: "Bed A",
      request_type: "plumbing",
      urgency: "high",
      status: "in_progress",
      assignedProviderName: "Manila Plumbers Inc.",
      assignedProviderContact: "09189998877",
      actualCost: 1500,
      description: "Leaking faucet in private bathroom",
      notes: "Technician dispatched on Monday",
      created_at: "2026-08-10T10:00:00.000Z",
    },
    {
      requestId: "MNT-00102",
      tenantName: "Maria Clara",
      branch: "guadalupe",
      roomNumber: "Room 105",
      requestType: "electrical",
      urgency: "emergency",
      status: "completed",
      costBreakdown: {
        isTenantChargeable: true,
        totalCost: 2400,
      },
      description: "Power socket sparking",
      created_at: "2026-08-12T14:30:00.000Z",
      completed_at: "2026-08-13T16:00:00.000Z",
    },
  ];

  const rows = formatMaintenanceForCSV(sampleRequests);
  assert.equal(rows.length, 2);

  // First row checks
  assert.equal(rows[0].requestId, "#MNT-00101");
  assert.equal(rows[0].tenantName, "Juan Dela Cruz");
  assert.equal(rows[0].tenantPhone, "09171234567");
  assert.equal(rows[0].tenantEmail, "juan@example.com");
  assert.equal(rows[0].branch, "Gil Puyat");
  assert.equal(rows[0].room, "Room 201 (Bed A)");
  assert.equal(rows[0].requestType, "Plumbing");
  assert.equal(rows[0].urgency, "Urgent");
  assert.equal(rows[0].stage, "In Progress");
  assert.equal(rows[0].assignedProvider, "Manila Plumbers Inc.");
  assert.equal(rows[0].providerContact, "09189998877");
  assert.equal(rows[0].actualCost, "1,500.00");
  assert.equal(rows[0].costAttribution, "Property Expense");

  // Second row checks
  assert.equal(rows[1].requestId, "#MNT-00102");
  assert.equal(rows[1].tenantName, "Maria Clara");
  assert.equal(rows[1].branch, "Guadalupe");
  assert.equal(rows[1].room, "Room 105");
  assert.equal(rows[1].requestType, "Electrical");
  assert.equal(rows[1].urgency, "Emergency");
  assert.equal(rows[1].stage, "Completed");
  assert.equal(rows[1].costAttribution, "Tenant Chargeable");
  assert.equal(rows[1].actualCost, "2,400.00");
});
