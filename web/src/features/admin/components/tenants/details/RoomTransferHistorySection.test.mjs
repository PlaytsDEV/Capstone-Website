/**
 * F4 — Tenant Details → Room Transfer History UI.
 *
 * Source-level assertions (house style): the section renders inside the
 * History tab, below the Room Stay Timeline; it consumes the SAME server
 * `roomTransferHistory` serializer values (no client-side money math); each
 * row is compact with an expandable View Details panel; View Bill routes to
 * the existing Billing tab; View Addendum opens the existing DigitalContract
 * viewer; legacy rows show "Completed" with no Cancel/Retry.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

const section = read("./RoomTransferHistorySection.jsx");
const historyTab = read("./TenantHistoryTab.jsx");
const detailModal = read("../../TenantDetailModal.jsx");
const overviewTab = read("./TenantOverviewTab.jsx");
const card = read("./ScheduledRoomTransferCard.jsx");

test("History tab renders RoomTransferHistorySection below the Room Stay Timeline", () => {
  assert.match(historyTab, /import RoomTransferHistorySection from "\.\/RoomTransferHistorySection"/);
  // Rendered AFTER the Room Stay Timeline block.
  const timelineIdx = historyTab.indexOf("Room Stay Timeline");
  const sectionIdx = historyTab.indexOf("<RoomTransferHistorySection");
  assert.ok(timelineIdx > -1 && sectionIdx > timelineIdx, "section must follow the timeline");
  assert.match(historyTab, /roomTransferHistory=\{roomTransferHistory\}/);
});

test("detail modal passes the server roomTransferHistory + a View Bill handler into the History tab", () => {
  assert.match(detailModal, /roomTransferHistory=\{tenant\?\.roomTransferHistory \|\| \[\]\}/);
  assert.match(detailModal, /onViewBill=\{handleViewBillFromHistory\}/);
  // View Bill just opens the canonical Financials tab — no billing rebuild.
  assert.match(detailModal, /const handleViewBillFromHistory = \(\) => \{\s*\n\s*setActiveTab\("financials"\);/);
});

test("section is presentational: no client-side money math, only formatMoney display", () => {
  assert.match(section, /import \{ formatDate, formatMoney \} from "\.\/tenantDetailConstants"/);
  // No arithmetic on amounts.
  assert.doesNotMatch(section, /amountDue\s*[-+*/]\s*/);
  assert.doesNotMatch(section, /rentAdjustment\s*[-+*/]/);
  // Reads canonical fields straight from the entry.
  assert.match(section, /entry\.finalSettlementAmount/);
  assert.match(section, /entry\.rentAdjustment/);
  assert.match(section, /entry\.securityDepositAdjustment/);
  assert.match(section, /entry\.transferBalance/);
});

test("only the 5 approved Admin statuses have tones — no internal enums", () => {
  const tones = section.match(/const STATUS_TONE = Object\.freeze\(\{[\s\S]*?\}\);/)[0];
  for (const s of ["awaiting_payment", "ready", "completed", "cancelled", "action_required"]) {
    assert.ok(tones.includes(s), `expected tone for ${s}`);
  }
  assert.doesNotMatch(tones, /\bscheduled\b|\bexecuted\b|cron|holdApplied/);
});

test("each row is compact + expandable (View Details), not five separate buttons", () => {
  assert.match(section, /const \[open, setOpen\] = useState\(false\)/);
  assert.match(section, /ChevronDown|ChevronRight/);
  // The detail-only actions live INSIDE the expanded panel.
  assert.match(section, /\{open && \(/);
});

test("View Bill uses the injected handler (canonical Billing detail), not a rebuilt bill", () => {
  assert.match(section, /entry\.settlementBillId && onViewBill && \(/);
  assert.match(section, /onClick=\{\(\) => onViewBill\(entry\.settlementBillId\)\}/);
  assert.doesNotMatch(section, /billingApi|createBill|BillDetail/);
});

test("View Addendum opens the existing DigitalContract viewer via onOpenDigitalContract", () => {
  assert.match(section, /entry\.addendumContractId && \(/);
  assert.match(section, /onOpenDigitalContract\(\{[\s\S]*?contractPurpose: "amendment"/);
});

test("Utilities note is the concise boundary statement, never a fake finalized amount", () => {
  assert.match(section, /normal utility billing cycle/i);
  assert.match(section, /effective transfer date as the room-responsibility boundary/i);
  assert.doesNotMatch(section, /finalizedElectricity|utilityAmount|kwh/i);
});

test("Action Required shows the friendly message, not a raw code", () => {
  assert.match(section, /entry\.status === "action_required" && entry\.actionRequiredMessage/);
});

test("legacy rows: Completed, marked as audit-only, no Cancel/Retry anywhere", () => {
  assert.match(section, /entry\.source === "legacy_immediate"/);
  assert.match(section, /Legacy transfer/);
  assert.match(section, /Audit record only/);
  assert.doesNotMatch(section, /Cancel Scheduled Transfer|Retry Transfer|runCancel|runRetry/);
});

test("empty history renders nothing (no confusing empty card)", () => {
  assert.match(section, /roomTransferHistory\.length === 0\)\s*\{\s*\n\s*return null;/);
});

// ── Overview card + History use the SAME canonical serializer values ───
test("Overview ScheduledRoomTransferCard is enriched with bed / created date / initiated-by / View Addendum", () => {
  assert.match(card, /destinationBed, scheduledAt, createdAt, initiatedBy, addendumContractId/);
  assert.match(card, /scheduledRoom\?\.needsBed && \(/);
  assert.match(card, /label="Destination Bed"/);
  assert.match(card, /label="Scheduled" value=\{formatDate\(scheduledAt \|\| createdAt\)\}/);
  assert.match(card, /label="Initiated By" value=\{initiatedBy\?\.name \|\| "System"\}/);
  assert.match(card, /View Addendum/);
  assert.match(card, /onOpenDigitalContract\(\{[\s\S]*?contractPurpose: "amendment"/);
});

test("Overview tab wires onOpenDigitalContract into the card", () => {
  assert.match(overviewTab, /onOpenDigitalContract,/);
  assert.match(overviewTab, /<ScheduledRoomTransferCard[\s\S]*?onOpenDigitalContract=\{onOpenDigitalContract\}/);
});
