import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Room from "../models/Room.js";
import Reservation from "../models/Reservation.js";
import BedHistory from "../models/BedHistory.js";
import { checkAndReleaseExpiredPaymentHolds } from "../services/paymentExpirationService.js";

test("Room model bed status enum supports cleaning_in_progress and turnover methods", () => {
  const room = new Room({
    name: "Test Room 101",
    roomNumber: "101",
    branch: "gil-puyat",
    type: "double-sharing",
    capacity: 2,
    price: 5000,
    beds: [
      { id: "bed-1", position: "lower", status: "occupied" },
      { id: "bed-2", position: "upper", status: "available" },
    ],
  });

  assert.equal(room.beds[0].status, "occupied");

  // Mark bed for cleaning
  const marked = room.markBedForCleaning("bed-1");
  assert.equal(marked, true);
  assert.equal(room.beds[0].status, "cleaning_in_progress");
  assert.equal(room.beds[0].occupiedBy.userId, null);

  // Complete cleaning
  const cleaned = room.completeBedCleaning("bed-1");
  assert.equal(cleaned, true);
  assert.equal(room.beds[0].status, "available");
});

test("Room model lockBed and extendBedLock operate correctly", () => {
  const userId = new mongoose.Types.ObjectId();
  const room = new Room({
    name: "Test Room 102",
    roomNumber: "102",
    branch: "guadalupe",
    type: "private",
    capacity: 1,
    price: 8000,
    beds: [{ id: "bed-single", position: "lower", status: "available" }],
  });

  const locked = room.lockBed("bed-single", userId, 10);
  assert.equal(locked, true);
  assert.equal(room.beds[0].status, "locked");
  assert.equal(String(room.beds[0].lockedBy), String(userId));
  assert.ok(room.beds[0].lockExpiresAt instanceof Date);

  // Extend lock
  const extended = room.extendBedLock("bed-single", userId, 20);
  assert.equal(extended, true);
  assert.ok(room.beds[0].lockExpiresAt.getTime() > Date.now());
});

test("Reservation model supports settlement summary, deposit refund status, and payment expiration", () => {
  const userId = new mongoose.Types.ObjectId();
  const roomId = new mongoose.Types.ObjectId();

  const reservation = new Reservation({
    userId,
    roomId,
    moveInDate: new Date(),
    totalPrice: 6000,
    monthlyRent: 6000,
    status: "approved_for_payment",
    paymentExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    depositRefundStatus: "pending",
    depositRefundReference: "REF-123456",
    refundDisbursementMethod: "gcash",
    refundAccountName: "Juan Cruz",
    refundAccountNumber: "09171234567",
    finalSettlementSummary: {
      securityDeposit: 6000,
      outstandingBalance: 1000,
      finalUtilityCharge: 450,
      damageDeductions: 200,
      keyDeduction: 0,
      netAmount: 4350,
      settlementType: "refund",
      settledAt: new Date(),
    },
  });

  assert.equal(reservation.depositRefundStatus, "pending");
  assert.equal(reservation.refundDisbursementMethod, "gcash");
  assert.equal(reservation.finalSettlementSummary.netAmount, 4350);
  assert.equal(reservation.finalSettlementSummary.settlementType, "refund");
  assert.ok(reservation.paymentExpiresAt instanceof Date);
});

test("BedHistory model supports dual-meter transfer audit fields", () => {
  const bedHistory = new BedHistory({
    bedId: "bed-1",
    roomId: new mongoose.Types.ObjectId(),
    tenantId: new mongoose.Types.ObjectId(),
    moveInDate: new Date(),
    status: "transferred",
    closedByAction: "transfer",
    transferSourceReading: 1250.5,
    transferTargetReading: 3400.0,
    proratedRentAdjustment: 500,
  });

  assert.equal(bedHistory.status, "transferred");
  assert.equal(bedHistory.transferSourceReading, 1250.5);
  assert.equal(bedHistory.transferTargetReading, 3400.0);
  assert.equal(bedHistory.proratedRentAdjustment, 500);
});

test("paymentExpirationService exports checkAndReleaseExpiredPaymentHolds function", () => {
  assert.equal(typeof checkAndReleaseExpiredPaymentHolds, "function");
});

