import mongoose from "mongoose";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const userFindOne = jest.fn();
const reservationFindOne = jest.fn();
const billFind = jest.fn();
const stayFindOne = jest.fn();
const maintenanceFind = jest.fn();
const conversationFind = jest.fn();
const buildAnnouncementTenantContext = jest.fn();
const canTenantViewAnnouncement = jest.fn();
const resolveTenantCanonicalContract = jest.fn();
const toMobileBill = jest.fn();
const toTenantContractView = jest.fn();

function queryResult(value) {
  const query = {
    select: jest.fn(() => query),
    sort: jest.fn(() => query),
    populate: jest.fn(() => query),
    limit: jest.fn(() => query),
    lean: jest.fn(() => Promise.resolve(value)),
  };
  return query;
}

await jest.unstable_mockModule("../../models/User.js", () => ({
  default: { findOne: userFindOne },
}));
await jest.unstable_mockModule("../../models/Reservation.js", () => ({
  default: { findOne: reservationFindOne },
}));
await jest.unstable_mockModule("../../models/Bill.js", () => ({
  default: { find: billFind },
}));
await jest.unstable_mockModule("../../models/Stay.js", () => ({
  default: { findOne: stayFindOne },
}));
await jest.unstable_mockModule("../../models/MaintenanceRequest.js", () => ({
  default: { find: maintenanceFind },
}));
await jest.unstable_mockModule("../../models/ChatConversation.js", () => ({
  default: { find: conversationFind },
}));
await jest.unstable_mockModule("../../mobile/services/announcementAudience.service.js", () => ({
  default: {
    PRESENT_STAY_STATUSES: ["active", "ending_soon", "expired_occupancy_continuing"],
    buildTenantContext: buildAnnouncementTenantContext,
    canTenantViewAnnouncement,
  },
}));
await jest.unstable_mockModule("../mobileBillingBridge.js", () => ({
  toMobileBill,
}));
await jest.unstable_mockModule("../tenantContractSelectionService.js", () => ({
  resolveTenantCanonicalContract,
}));
await jest.unstable_mockModule("../tenantContractViewService.js", () => ({
  toTenantContractView,
}));

const {
  buildNeutralContext,
  resolveTenantAIContext,
} = await import("./tenantContextResolver.js");

describe("canonical Lily tenant context", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("active occupancy overrides stale move-in/profile state and all domain snapshots use canonical owners", async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const now = new Date("2026-08-17T08:00:00Z");
    const user = {
      _id: tenantId,
      user_id: "tenant-firebase-id",
      firstName: "Ava",
      lastName: "Guest",
      email: "ava@example.com",
      branch: "guadalupe",
    };
    const activeStay = {
      _id: new mongoose.Types.ObjectId(),
      tenantId,
      branch: "gil-puyat",
      status: "active",
      leaseStartDate: new Date("2026-08-13T00:00:00Z"),
      bedCode: "A-L",
      roomId: { _id: new mongoose.Types.ObjectId(), roomNumber: "GP-202", branch: "gil-puyat" },
    };
    const reservation = {
      userId: tenantId,
      status: "moveIn",
      moveInDate: new Date("2026-08-13T00:00:00Z"),
      roomId: { roomNumber: "GP-202", branch: "gil-puyat" },
      selectedBed: { id: "stale-bed" },
    };
    const currentBill = {
      _id: "current-bill",
      status: "pending",
      isArchived: false,
      billType: "monthly",
      billingCycleStart: new Date("2026-08-01T00:00:00Z"),
      billingCycleEnd: new Date("2026-09-01T00:00:00Z"),
      billingMonth: new Date("2026-08-01T00:00:00Z"),
      charges: {},
    };
    const futureDraft = {
      _id: "future-draft",
      status: "draft",
      isArchived: false,
      billType: "monthly",
      billingCycleStart: new Date("2026-09-01T00:00:00Z"),
      billingCycleEnd: new Date("2026-10-01T00:00:00Z"),
      dueDate: new Date("2026-09-23T00:00:00Z"),
    };
    const contract = { _id: "contract-1", status: "generated" };
    const conversations = [{
      _id: "conversation-1",
      category: "maintenance_concern",
      priority: "high",
      status: "resolved",
      lastMessage: "Repair completed.",
    }];
    const announcements = [
      { _id: "global", title: "Global", targetBranch: "both" },
      { _id: "gil", title: "Gil Notice", targetBranch: "gil-puyat" },
      { _id: "gua", title: "Guadalupe Notice", targetBranch: "guadalupe" },
    ];

    userFindOne.mockReturnValue(queryResult(user));
    stayFindOne.mockReturnValue(queryResult(activeStay));
    reservationFindOne.mockReturnValue(queryResult(reservation));
    billFind.mockReturnValue(queryResult([futureDraft, currentBill]));
    maintenanceFind.mockReturnValue(queryResult([]));
    conversationFind.mockReturnValue(queryResult(conversations));
    buildAnnouncementTenantContext.mockResolvedValue({
      authenticated: true,
      mongoId: tenantId,
      userId: user.user_id,
      branch: "gil-puyat",
      branchSource: "stay",
    });
    canTenantViewAnnouncement.mockImplementation(({ announcement, tenantContext }) => (
      announcement.targetBranch === "both"
      || announcement.targetBranch === tenantContext.branch
    ));
    resolveTenantCanonicalContract.mockResolvedValue(contract);
    toTenantContractView.mockReturnValue({
      id: "contract-1",
      contractNumber: "CTR-1",
      status: "generated",
      displayStatus: "Prepared Contract Available",
      leaseStartDate: new Date("2026-08-13T00:00:00Z"),
      leaseEndDate: new Date("2027-08-13T00:00:00Z"),
      daysRemaining: 361,
      approvedMonthlyRate: 5400,
      securityDepositAmount: 5400,
      roomNumber: "GP-202",
      bedLabel: "A-L",
      roomType: "quadruple-sharing",
      tenantDocument: { available: true, version: 2, label: "Prepared Contract" },
    });
    toMobileBill.mockImplementation((bill) => ({
      billing_id: String(bill._id),
      billing_period: "August 2026",
      total: 7200,
      remaining_amount: 7200,
      paid_amount: 0,
      rent: 5400,
      electricity: 1800,
      water: 0,
      status: "unpaid",
      status_label: "Unpaid",
      due_date: new Date("2026-08-23T00:00:00Z"),
      release_date: new Date("2026-08-16T00:00:00Z"),
      utility_deadlines: { electricity: { billReleaseDate: new Date("2026-08-16T00:00:00Z") } },
    }));

    const announcementCursor = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn(async () => announcements),
    };
    const db = {
      collection: jest.fn((name) => {
        if (name === "announcements") return { find: jest.fn(() => announcementCursor) };
        throw new Error(`unexpected collection: ${name}`);
      }),
    };

    const context = await resolveTenantAIContext(tenantId, user, { db, now });

    expect(context).toMatchObject({
      branch: "Gil Puyat",
      branchRaw: "gil-puyat",
      branchSource: "stay",
      roomNumber: "GP-202",
      bedPosition: "A-L",
      tenancy: {
        status: "active",
        isCurrentResident: true,
        scheduledMoveInDate: null,
      },
      currentBill: {
        billId: "current-bill",
        status: "unpaid",
        utilityReleased: true,
      },
      contract: {
        contractId: "contract-1",
        tenantDocument: { available: true, version: 2 },
      },
      inquiries: [{
        conversationId: "conversation-1",
        status: "resolved",
      }],
    });
    expect(context.recentAnnouncements.map((item) => item.title)).toEqual([
      "Global",
      "Gil Notice",
    ]);
    expect(toMobileBill).toHaveBeenCalledWith(currentBill);
    expect(toMobileBill).not.toHaveBeenCalledWith(futureDraft);
    expect(billFind).toHaveBeenCalledWith(expect.objectContaining({
      userId: expect.any(mongoose.Types.ObjectId),
      status: { $ne: "draft" },
      isArchived: false,
    }));
    expect(resolveTenantCanonicalContract).toHaveBeenCalledWith(
      expect.any(mongoose.Types.ObjectId),
      { includeEarlyStages: true },
    );
  });

  test("neutral fallback never fabricates a branch, room, bed, bill, or move-in date", () => {
    expect(buildNeutralContext({ firstName: "Ava" })).toMatchObject({
      tenantName: "Ava",
      branch: "Lilycrest Residence",
      branchRaw: null,
      roomNumber: null,
      bedPosition: null,
      currentBill: null,
      contract: null,
      tenancy: {
        status: "unknown",
        isCurrentResident: false,
        scheduledMoveInDate: null,
      },
    });
  });
});
