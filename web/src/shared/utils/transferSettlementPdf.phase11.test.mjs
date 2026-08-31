/**
 * PHASE 11 — Room Transfer "Download Estimate PDF" must mirror the canonical
 * server settlement preview (transferPreview) shown on screen. Source-level
 * assertions (house style) that the legacy frontend proration is gone from the
 * PDF path and the PDF now reads its figures from data.transferPreview.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

const receiptGen = read("./receiptGenerator.js");
const transferModal = read("../../features/admin/components/TenantWorkspaceModals.jsx");

test("PDF generator drives the transfer branch from data.transferPreview", () => {
  assert.match(receiptGen, /const xfer = isTransfer \? \(data\.transferPreview \|\| null\) : null;/);
  assert.match(receiptGen, /totalAmt = isTransfer\s*\?\s*Number\(xfer\?\.totalImmediateDue \|\| 0\)/);
});

test("PDF transfer totals = Rent Adjustment + Additional Security Deposit only", () => {
  assert.match(receiptGen, /label: "Rent Adjustment:", amount: Number\(r\.adjustmentDue \|\| 0\)/);
  assert.match(receiptGen, /label: "Additional Security Deposit:", amount: Number\(d\.balanceDue \|\| 0\)/);
  assert.match(receiptGen, /"TOTAL IMMEDIATE DUE:"/);
  // legacy: estimatedTotal / proRataPreview must not drive the PDF anymore
  assert.doesNotMatch(receiptGen, /data\.estimatedTotal/);
  assert.doesNotMatch(receiptGen, /data\.proRataPreview/);
});

test("PDF shows the canonical old/destination rent + deposit lines", () => {
  assert.match(receiptGen, /Old \/ Current Rent/);
  assert.match(receiptGen, /Destination Rent/);
  assert.match(receiptGen, /Security Deposit Required \(destination room\)/);
  assert.match(receiptGen, /Less: Security Deposit Already Held/);
  assert.match(receiptGen, /Additional Security Deposit Due/);
  assert.match(receiptGen, /Excess Prepaid Rent -> Rent Credit/);
  assert.match(receiptGen, /Excess Deposit Held/);
});

test("PDF marks electricity + water informational, excluded from Total Immediate Due", () => {
  assert.match(receiptGen, /Estimated Source-Room Electricity \(informational\)/);
  assert.match(receiptGen, /NOT included in Total Immediate Due/);
  assert.match(receiptGen, /Water \(informational\)/);
  assert.match(receiptGen, /billed once during their normal utility period close/);
});

test("PDF handles a legacy record with unknown held deposit without inventing ₱0", () => {
  assert.match(receiptGen, /d\.heldKnown\s*\n?\s*\?\s*"Deposit cash currently on file/);
  assert.match(receiptGen, /Legacy record — held deposit amount unavailable/);
});

test("transfer modal passes the canonical preview object into the PDF generator", () => {
  assert.match(transferModal, /transferPreview: preview,/);
  assert.match(transferModal, /currentRent: preview\.rent\?\.sourceEffectiveRate \?\? currentPrice,/);
  assert.match(transferModal, /newRent: preview\.rent\?\.destinationApprovedRate \?\? newPrice,/);
  // A financial estimate requires both a loaded preview and verified held cash.
  assert.match(transferModal, /disabled=\{pdfLoading \|\| !preview \|\| preview\.deposit\?\.heldKnown === false\}/);
});

test("transfer modal no longer computes a hand-rolled proration / estimatedTotal", () => {
  assert.doesNotMatch(transferModal, /const proRataPreview =/);
  assert.doesNotMatch(transferModal, /const estimatedTotal =/);
  assert.doesNotMatch(transferModal, /const daysSinceCycleStart =/);
});
