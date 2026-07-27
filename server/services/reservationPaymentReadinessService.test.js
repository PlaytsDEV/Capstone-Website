import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import {
  buildReservationPaymentPricingSnapshot,
} from "./reservationPaymentPolicy.js";

const userFindById = jest.fn();
const roomFindById = jest.fn();
const reservationFindOne = jest.fn();
const stayFindOne = jest.fn();
const lean = (value) => ({ lean: jest.fn().mockResolvedValue(value) });

await jest.unstable_mockModule("../models/index.js", () => ({
  User: { findById: userFindById },
  Room: { findById: roomFindById },
  Reservation: { findById: jest.fn(), findOne: reservationFindOne },
  Stay: { findOne: stayFindOne },
}));
await jest.unstable_mockModule("../config/contractConfig.js", () => ({
  validateBranchRoomType: (_branch, roomType) =>
    String(roomType).replaceAll("_", "-"),
}));
await jest.unstable_mockModule("../utils/lifecycleNaming.js", () => ({
  readMoveInDate: (reservation) => reservation.intendedMoveInDate,
  reservationStatusesForQuery: (...statuses) => statuses,
}));

const { evaluateReservationPaymentReadiness } =
  await import("./reservationPaymentReadinessService.js");

const snapshot = () => buildReservationPaymentPricingSnapshot({
  monthlyRent: 6300,
  reservationFeeAmount: 1000,
  moveInCashOut: {
    monthlyAdvance: 6300,
    securityDeposit: 6300,
    netAmountDue: 11600,
  },
});
const completeReservation = () => ({
  _id: "reservation-1",
  userId: "user-1",
  roomId: "room-1",
  firstName: "Test",
  lastName: "Tenant",
  mobileNumber: "09171234567",
  address: { city: "Makati", region: "NCR" },
  applicationSubmittedAt: new Date(),
  selectedBed: { id: "bed-1" },
  preferredRoomType: "quadruple-sharing",
  intendedMoveInDate: new Date(Date.now() + 86_400_000),
  leaseDuration: 3,
  leaseType: "short_term",
  paymentExpiresAt: new Date(Date.now() + 86_400_000),
  approvedPaymentMethods: ["paymongo"],
  paymentPricingSnapshot: snapshot(),
  documentPrechecks: {
    selfiePhoto: { precheckStatus: "passed" },
    validIDFront: { precheckStatus: "passed" },
    validIDBack: { precheckStatus: "passed" },
  },
});
const completeRoom = () => ({
  _id: "room-1",
  branch: "gil-puyat",
  type: "quadruple-sharing",
  available: true,
  isArchived: false,
  beds: [{ id: "bed-1", status: "available" }],
});

describe("evaluateReservationPaymentReadiness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userFindById.mockReturnValue(lean({ _id: "user-1" }));
    roomFindById.mockReturnValue(lean(completeRoom()));
    reservationFindOne.mockReturnValue(lean(null));
    stayFindOne.mockReturnValue(lean(null));
  });

  test("a complete authoritative Reservation is ready", async () => {
    const result = await evaluateReservationPaymentReadiness(
      completeReservation(),
      { proposedDeadline: new Date(Date.now() + 60_000) },
    );
    expect(result.ready).toBe(true);
    expect(result.missingFields).toEqual([]);
  });

  test.each([
    ["applicationSubmittedAt", (record) => { record.applicationSubmittedAt = null; }],
    ["legalApplicantIdentity", (record) => { record.firstName = ""; }],
    ["bedId", (record) => { record.selectedBed = {}; }],
    ["moveInDate", (record) => { record.intendedMoveInDate = null; }],
    ["leaseDuration", (record) => { record.leaseDuration = null; }],
    ["leaseType", (record) => { record.leaseType = null; }],
    ["approvedAdvanceRent", (record) => { record.paymentPricingSnapshot.advanceRent = null; }],
    ["approvedSecurityDeposit", (record) => {
      record.paymentPricingSnapshot.securityDeposit = null;
    }],
    ["approvedReservationFee", (record) => {
      record.paymentPricingSnapshot.reservationFeeCredit = null;
    }],
    ["paymentMethod", (record) => { record.approvedPaymentMethods = []; }],
    ["requiredDocuments", (record) => {
      record.documentPrechecks.validIDFront.precheckStatus = "needs_reupload";
    }],
    ["requiredDocuments", (record) => {
      record.documentPrechecks.validIDFront = null;
    }],
  ])("reports %s without transitioning", async (field, mutate) => {
    const record = completeReservation();
    mutate(record);
    const result = await evaluateReservationPaymentReadiness(
      record,
      { proposedDeadline: new Date(Date.now() + 60_000) },
    );
    expect(result.ready).toBe(false);
    expect(result.missingFields).toContain(field);
  });

  test("rejects an unavailable room and bed", async () => {
    const room = completeRoom();
    room.available = false;
    room.beds[0].status = "occupied";
    roomFindById.mockReturnValue(lean(room));
    const result = await evaluateReservationPaymentReadiness(
      completeReservation(),
      { proposedDeadline: new Date(Date.now() + 60_000) },
    );
    expect(result.missingFields).toEqual(
      expect.arrayContaining(["activeRoom", "bedAvailability"]),
    );
  });
});
