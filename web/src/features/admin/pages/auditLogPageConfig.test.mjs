import test from "node:test";
import assert from "node:assert/strict";
import {
  AUDIT_TRAIL_TAB,
  SECURITY_SIGNALS_TAB,
  buildAuditExportFilters,
  buildAuditLogQueryParams,
  createDefaultAuditFilters,
  hasActiveAuditFilters,
  isAuditQueryFiltered,
  formatAuditBranch,
  formatAuditLabel,
  formatAuditActionDetails,
  getAllowedAuditTabs,
  mapAuditSeverityToBadgeStatus,
  normalizeAuditTab,
} from "./auditLogPageConfig.mjs";

test("owners get both audit views while branch admins stay on audit trail", () => {
  assert.deepEqual(getAllowedAuditTabs(false), [AUDIT_TRAIL_TAB]);
  assert.deepEqual(getAllowedAuditTabs(true), [
    AUDIT_TRAIL_TAB,
    SECURITY_SIGNALS_TAB,
  ]);
  assert.equal(normalizeAuditTab(SECURITY_SIGNALS_TAB, false), AUDIT_TRAIL_TAB);
  assert.equal(normalizeAuditTab(SECURITY_SIGNALS_TAB, true), SECURITY_SIGNALS_TAB);
});

test("default audit filters start with a bounded recent date range", () => {
  const now = new Date("2026-04-20T09:00:00.000Z");
  const filters = createDefaultAuditFilters(now);

  assert.equal(filters.type, "all");
  assert.equal(filters.severity, "all");
  assert.equal(filters.branch, "all");
  assert.equal(filters.role, "all");
  assert.equal(filters.startDate, "2026-04-13");
  assert.equal(filters.endDate, "2026-04-20");
});

test("audit query params align with backend enums and preserve pagination inputs with local timezone boundaries", () => {
  const params = buildAuditLogQueryParams(
    {
      type: "data_modification",
      severity: "high",
      branch: "gil-puyat",
      role: "branch_admin",
      user: " admin@example.com ",
      search: " permission change ",
      startDate: "2026-04-01",
      endDate: "2026-04-20",
    },
    { currentPage: 3, itemsPerPage: 25 },
  );

  const expectedStart = new Date(2026, 3, 1, 0, 0, 0, 0).toISOString();
  const expectedEnd = new Date(2026, 3, 20, 23, 59, 59, 999).toISOString();

  assert.deepEqual(params, {
    type: "data_modification",
    severity: "high",
    branch: "gil-puyat",
    role: "branch_admin",
    user: "admin@example.com",
    search: "permission change",
    startDate: expectedStart,
    endDate: expectedEnd,
    limit: "25",
    offset: "50",
  });

  const exportFilters = buildAuditExportFilters({
    type: "login",
    severity: "warning",
    startDate: "2026-04-18",
    endDate: "2026-04-20",
  });

  const expectedExportStart = new Date(2026, 3, 18, 0, 0, 0, 0).toISOString();

  assert.deepEqual(exportFilters, {
    type: "login",
    severity: "warning",
    startDate: expectedExportStart,
    endDate: expectedEnd,
  });
});

test("isAuditQueryFiltered accurately detects active filters vs all-time query", () => {
  assert.equal(
    isAuditQueryFiltered({
      type: "all",
      severity: "all",
      branch: "all",
      role: "all",
      user: "",
      search: "",
      preset: "all",
      startDate: "",
      endDate: "",
    }),
    false,
  );

  assert.equal(
    isAuditQueryFiltered({
      type: "all",
      severity: "all",
      branch: "all",
      role: "all",
      user: "",
      search: "",
      preset: "today",
      startDate: "2026-08-16",
      endDate: "2026-08-16",
    }),
    true,
  );

  assert.equal(
    isAuditQueryFiltered({
      type: "login",
      severity: "all",
      branch: "all",
      role: "all",
      user: "",
      search: "",
      preset: "all",
      startDate: "",
      endDate: "",
    }),
    true,
  );
});

test("audit labels and severity badges stay readable", () => {
  assert.equal(formatAuditLabel("data_modification"), "Data Modification");
  assert.equal(formatAuditBranch("general"), "General / System");
  assert.equal(formatAuditBranch("gil-puyat"), "Gil Puyat");
  assert.equal(mapAuditSeverityToBadgeStatus("high"), "overdue");
  assert.equal(mapAuditSeverityToBadgeStatus("critical"), "banned");
});

test("formatAuditActionDetails cleans up misleading legacy fallbacks", () => {
  assert.equal(
    formatAuditActionDetails({
      action: "Tenant previewed signed Contract LIL-GP-2026-00007 version 1",
      details: "Created new contract record",
      type: "data_modification",
    }),
    "Document viewed in browser",
  );

  assert.equal(
    formatAuditActionDetails({
      action: "User login successful",
      details: "Login from Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      type: "login",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
    }),
    "Signed in via Chrome · Windows",
  );

  assert.equal(
    formatAuditActionDetails({
      action: "User logout",
      details: "tenant logged out",
      type: "login",
    }),
    "tenant logged out",
  );
});

