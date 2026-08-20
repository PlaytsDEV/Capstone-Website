import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import mongoose from "mongoose";

const mockViolationSave = jest.fn();
let mockViolationDoc = null;
const mockBillSave = jest.fn();
let mockBillDoc = null;
const mockReviewSave = jest.fn();

const mockComputeWarningCount = jest.fn().mockResolvedValue(1);

const mockFindViolations = jest.fn();
const mockFindOneViolation = jest.fn();
const mockFindByIdViolation = jest.fn();

await jest.unstable_mockModule("../../models/index.js", () => {
  class MockTenantViolation {
    constructor(data) {
      Object.assign(this, data);
      this._id = new mongoose.Types.ObjectId();
      this.save = mockViolationSave.mockResolvedValue(this);
    }
    static computeWarningCount = mockComputeWarningCount;
    static find = mockFindViolations;
    static findOne = mockFindOneViolation;
    static findById = mockFindByIdViolation;
  }

  class MockTerminationReview {
    constructor(data) {
      Object.assign(this, data);
      this._id = new mongoose.Types.ObjectId();
      this.save = mockReviewSave.mockResolvedValue(this);
    }
    static find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
  }

  return {
    TenantViolation: MockTenantViolation,
    TerminationReview: MockTerminationReview,
    Reservation: {
      find: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(),
            userId: {
              _id: new mongoose.Types.ObjectId(),
              firstName: "Juan",
              lastName: "Dela Cruz",
              email: "juan@example.com",
            },
            roomId: {
              name: "Room 101",
              roomNumber: "101",
              branch: "gil-puyat",
            },
            branch: "gil-puyat",
          },
        ]),
      }),
      findById: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          branch: "gil-puyat",
          roomId: { _id: new mongoose.Types.ObjectId(), branch: "gil-puyat" },
        }),
      }),
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          branch: "gil-puyat",
          roomId: { _id: new mongoose.Types.ObjectId(), branch: "gil-puyat" },
        }),
      }),
    },
    Room: {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ _id: new mongoose.Types.ObjectId(), branch: "gil-puyat" }]),
      }),
    },
    Bill: {
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockImplementation(() => {
          if (!mockBillDoc) return Promise.resolve(null);
          return Promise.resolve(mockBillDoc);
        }),
      }),
    },
    User: {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          firstName: "Juan",
          lastName: "Dela Cruz",
          role: "tenant",
          branch: "gil-puyat",
        }),
      }),
    },
    VIOLATION_TYPES: [
      "smoking_inside",
      "cooking_in_room",
      "unauthorized_appliance",
      "unauthorized_visitors",
      "rfid_misuse",
      "unauthorized_bed_transfer",
      "unauthorized_room_transfer",
      "property_damage",
      "cleanliness_issues",
      "persistent_unpaid_bills",
      "custom",
    ],
  };
});

await jest.unstable_mockModule("./_helpers.js", () => ({
  getAdminInfo: jest.fn().mockResolvedValue({ isOwner: true, branch: "gil-puyat", _id: new mongoose.Types.ObjectId() }),
  resolveAdminUserId: jest.fn().mockImplementation((req, admin) => admin?._id || req?.user?._id || new mongoose.Types.ObjectId()),
  CURRENT_RESIDENT_STATUS_QUERY: ["checked-in", "active"],
}));

await jest.unstable_mockModule("../../middleware/logger.js", () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

await jest.unstable_mockModule("../../utils/billingAudit.js", () => ({
  logBillingAudit: jest.fn().mockResolvedValue({}),
}));

await jest.unstable_mockModule("../../services/notifications/notificationService.js", () => ({
  createNotification: jest.fn().mockResolvedValue({ _id: new mongoose.Types.ObjectId() }),
  notify: jest.fn().mockResolvedValue(true),
  default: jest.fn().mockResolvedValue(true),
}));

const {
  getViolations,
  getActiveTenantsForViolations,
  createViolation,
  updateViolationDecision,
} = await import("./tenantViolationController.js");

describe("Tenant Violation Controller Unit Tests", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    mockViolationDoc = null;
    mockBillDoc = null;

    req = {
      user: { _id: new mongoose.Types.ObjectId(), role: "admin", branch: "gil-puyat" },
      branchFilter: "gil-puyat",
      query: {},
      params: {},
      body: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  test("getViolations returns violations list and computed summary stats", async () => {
    mockFindViolations.mockImplementation((filter) => ({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          _id: new mongoose.Types.ObjectId(),
          branch: "gil-puyat",
          violationType: "smoking_inside",
          status: "confirmed",
          penaltyApplied: 500,
          tenantId: { firstName: "Maria", lastName: "Clara", email: "maria@example.com" },
        },
      ]),
      select: jest.fn().mockReturnThis(),
    }));

    await getViolations(req, res, next);

    expect(res.json).toHaveBeenCalled();
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.stats).toBeDefined();
  });

  test("getActiveTenantsForViolations returns residents with calculated warning count", async () => {
    mockComputeWarningCount.mockResolvedValue(2);

    await getActiveTenantsForViolations(req, res, next);

    expect(res.json).toHaveBeenCalled();
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.data[0].warningCount).toBe(2);
    expect(response.data[0].fullName).toBe("Juan Dela Cruz");
  });

  test("createViolation validates inputs and rejects future incident date", async () => {
    req.body = {
      tenantId: new mongoose.Types.ObjectId(),
      violationType: "smoking_inside",
      dateOfIncident: "2099-01-01", // Future date
      locationOfIncident: "Room 101",
      evidenceNotes: "Found cigarette butts",
    };

    await createViolation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Incident date cannot be in the future." }),
    );
  });

  test("createViolation enforces penaltyReason when penaltyApplied > 0", async () => {
    req.body = {
      tenantId: new mongoose.Types.ObjectId(),
      violationType: "smoking_inside",
      dateOfIncident: "2026-08-15",
      locationOfIncident: "Room 101",
      evidenceNotes: "Found cigarette butts",
      penaltyApplied: 500,
      penaltyReason: "", // Empty reason
    };

    await createViolation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "A penalty reason is required when a monetary penalty is applied.",
      }),
    );
  });

  test("createViolation creates record and auto-attaches penalty to bill when chargeToBill is true", async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const reservationId = new mongoose.Types.ObjectId();

    mockBillDoc = {
      _id: new mongoose.Types.ObjectId(),
      additionalCharges: [],
      charges: { penalty: 0 },
      totalAmount: 5000,
      remainingAmount: 5000,
      save: mockBillSave.mockResolvedValue(true),
    };

    req.body = {
      tenantId,
      reservationId,
      violationType: "smoking_inside",
      dateOfIncident: "2026-08-15",
      locationOfIncident: "Room 101",
      evidenceNotes: "Found cigarette butts in balcony",
      penaltyApplied: 500,
      penaltyReason: "Cleaning & ozone deodorization fee",
      chargeToBill: true,
    };

    await createViolation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.message).toBe("Violation record logged successfully.");
    expect(mockBillSave).toHaveBeenCalled();
    expect(mockBillDoc.charges.penalty).toBe(500);
    expect(mockBillDoc.totalAmount).toBe(5500);
    expect(mockBillDoc.additionalCharges[0].name).toContain("Violation Penalty");
  });

  test("updateViolationDecision auto-escalates to TerminationReview when escalated status is chosen", async () => {
    const violationId = new mongoose.Types.ObjectId();
    const mockViolationInstance = {
      _id: violationId,
      branch: "gil-puyat",
      reservationId: new mongoose.Types.ObjectId(),
      tenantId: new mongoose.Types.ObjectId(),
      violationType: "smoking_inside",
      status: "reported",
      adminDecision: null,
      save: mockViolationSave.mockResolvedValue(true),
    };

    mockFindByIdViolation.mockResolvedValue(mockViolationInstance);

    req.params = { id: violationId };
    req.body = {
      decision: "confirmed",
      decisionReason: "Repeated severe violation with no remorse shown",
      status: "escalated",
    };

    await updateViolationDecision(req, res, next);

    expect(mockViolationInstance.status).toBe("escalated");
    expect(mockViolationInstance.adminDecision).toBe("confirmed");
    expect(mockViolationSave).toHaveBeenCalled();
    expect(mockReviewSave).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Violation decision updated successfully.",
      }),
    );
  });
});
