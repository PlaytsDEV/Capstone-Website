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
    static countDocuments = jest.fn().mockResolvedValue(1);
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
    static findOne = jest.fn().mockResolvedValue(null);
  }

  class MockBill {
    constructor(data) {
      Object.assign(this, data);
      this._id = new mongoose.Types.ObjectId();
      this.save = mockBillSave.mockResolvedValue(this);
    }
    static findOne = jest.fn().mockImplementation(() => {
      const result = mockBillDoc;
      return {
        sort: jest.fn().mockImplementation(() => Promise.resolve(result)),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
        catch: (reject) => Promise.resolve(result).catch(reject),
      };
    });
    static updateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });
  }

  return {
    TenantViolation: MockTenantViolation,
    TerminationReview: MockTerminationReview,
    Bill: MockBill,
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
  getViolationById,
  createViolation,
  updateViolationDecision,
  updateViolation,
  archiveViolation,
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

    mockFindViolations.mockImplementation((filter) => ({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
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
  });

  test("getViolations returns violations list and computed summary stats", async () => {
    await getViolations(req, res, next);

    expect(res.json).toHaveBeenCalled();
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.stats).toBeDefined();
  });

  test("getViolations returns structured pagination metadata", async () => {
    req.query = { page: "1", limit: "10" };
    await getViolations(req, res, next);
    expect(res.json).toHaveBeenCalled();
    const response = res.json.mock.calls[0][0];
    expect(response.pagination).toEqual({
      total: expect.any(Number),
      page: 1,
      limit: 10,
      totalPages: expect.any(Number),
    });
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

  test("updateViolationDecision properly accepts targetStatus payload key from frontend modal", async () => {
    const violationId = new mongoose.Types.ObjectId();
    const mockViolationInstance = {
      _id: violationId,
      branch: "gil-puyat",
      reservationId: new mongoose.Types.ObjectId(),
      tenantId: new mongoose.Types.ObjectId(),
      violationType: "noise_curfew",
      status: "reported",
      adminDecision: null,
      save: mockViolationSave.mockResolvedValue(true),
    };

    mockFindByIdViolation.mockResolvedValue(mockViolationInstance);

    req.params = { id: violationId };
    req.body = {
      decision: "confirmed",
      decisionReason: "First offense noisy gathering after curfew",
      targetStatus: "warning_issued", // Key sent by frontend modal
    };

    await updateViolationDecision(req, res, next);

    expect(mockViolationInstance.status).toBe("warning_issued");
    expect(mockViolationInstance.adminDecision).toBe("confirmed");
    expect(mockViolationSave).toHaveBeenCalled();
  });




  describe("Standalone Penalty Bill Generation", () => {
    test("createViolation generates a standalone bill if no open bill exists", async () => {
      mockBillDoc = null; 
      
      req.body = {
        tenantId: new mongoose.Types.ObjectId(),
        violationType: "smoking_inside",
        dateOfIncident: "2026-08-15",
        evidenceNotes: "Found cigarette butts",
        penaltyApplied: 500,
        penaltyReason: "Cleaning fee",
        chargeToBill: true,
      };

      await createViolation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockBillSave).toHaveBeenCalled(); // Standalone bill
    });
  });

  describe("3rd-Strike Auto-Escalation", () => {
    test("createViolation escalates on 3rd warning", async () => {
      mockComputeWarningCount.mockResolvedValue(2); // next will be 3
      req.body = {
        tenantId: new mongoose.Types.ObjectId(),
        violationType: "smoking_inside",
        dateOfIncident: "2026-08-15",
        evidenceNotes: "Found cigarette butts",
      };

      await createViolation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockReviewSave).toHaveBeenCalled(); // Should have created a review
      const response = res.json.mock.calls[0][0];
      expect(response.data.status).toBe("escalated");
    });
  });

  describe("In-Office Violation Management CRUD", () => {
    test("updateViolation modifies incident details and returns updated document", async () => {
      const violationId = new mongoose.Types.ObjectId();
      const mockViolationInstance = {
        _id: violationId,
        tenantId: new mongoose.Types.ObjectId(),
        branch: "gil-puyat",
        status: "reported",
        locationOfIncident: "Room 301",
        evidenceNotes: "Original notes",
        isArchived: false,
        save: jest.fn().mockResolvedValue(true),
      };
      mockFindByIdViolation.mockResolvedValue(mockViolationInstance);

      req.params = { id: violationId };
      req.body = {
        locationOfIncident: "Room 405",
        evidenceNotes: "Tenant presented authorized appliance permit during in-office visit.",
      };

      await updateViolation(req, res, next);

      expect(mockViolationInstance.locationOfIncident).toBe("Room 405");
      expect(mockViolationInstance.evidenceNotes).toBe(
        "Tenant presented authorized appliance permit during in-office visit.",
      );
      expect(mockViolationInstance.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Violation record updated successfully.",
        }),
      );
    });

    test("archiveViolation soft-deletes record and cancels unpaid penalty bills", async () => {
      const violationId = new mongoose.Types.ObjectId();
      const mockViolationInstance = {
        _id: violationId,
        tenantId: new mongoose.Types.ObjectId(),
        branch: "gil-puyat",
        isArchived: false,
        save: jest.fn().mockResolvedValue(true),
      };
      mockFindByIdViolation.mockResolvedValue(mockViolationInstance);

      req.params = { id: violationId };

      await archiveViolation(req, res, next);

      expect(mockViolationInstance.isArchived).toBe(true);
      expect(mockViolationInstance.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Violation record archived successfully.",
        }),
      );
    });

    test("updateViolationDecision voids standalone penalty bills upon dismissal", async () => {
      const violationId = new mongoose.Types.ObjectId();
      const mockViolationInstance = {
        _id: violationId,
        tenantId: new mongoose.Types.ObjectId(),
        reservationId: null,
        branch: "gil-puyat",
        penaltyApplied: 500,
        status: "penalty_issued",
        adminDecision: null,
        save: mockViolationSave.mockResolvedValue(true),
      };
      mockFindByIdViolation.mockResolvedValue(mockViolationInstance);

      req.params = { id: violationId };
      req.body = {
        decision: "dismissed",
        decisionReason: "In-office appeal substantiated; fine waived.",
      };

      await updateViolationDecision(req, res, next);

      expect(mockViolationInstance.status).toBe("dismissed");
      expect(mockViolationInstance.adminDecision).toBe("dismissed");
      expect(mockViolationSave).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Violation decision updated successfully.",
        }),
      );
    });

    describe("Security Validation Guards", () => {
      test("rejects invalid MongoDB ObjectId in req.params with 400 Bad Request", async () => {
        req.params = { id: "invalid-id-123" };
        await getViolationById(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: "Invalid violation ID format.",
          }),
        );
      });

      test("sanitizes HTML tags from evidenceNotes and location during updateViolation", async () => {
        const violationId = new mongoose.Types.ObjectId();
        const mockViolationInstance = {
          _id: violationId,
          tenantId: new mongoose.Types.ObjectId(),
          branch: "gil-puyat",
          status: "reported",
          isArchived: false,
          save: jest.fn().mockResolvedValue(true),
        };
        mockFindByIdViolation.mockResolvedValue(mockViolationInstance);

        req.params = { id: violationId.toString() };
        req.body = {
          evidenceNotes: "<script>alert('xss')</script>Clean notes provided by tenant.",
          locationOfIncident: "<b>Room 302</b>",
        };

        await updateViolation(req, res, next);

        expect(mockViolationInstance.evidenceNotes).toBe("Clean notes provided by tenant.");
        expect(mockViolationInstance.locationOfIncident).toBe("Room 302");
        expect(mockViolationInstance.save).toHaveBeenCalled();
      });
    });

    describe("Unified Penalty Synchronizer", () => {
      test("updateViolation automatically adjusts bill line-item when penalty amount is updated", async () => {
        const violationId = new mongoose.Types.ObjectId();
        const reservationId = new mongoose.Types.ObjectId();
        const tenantId = new mongoose.Types.ObjectId();
        const violationShortId = violationId.toString().slice(-6);

        const mockViolationInstance = {
          _id: violationId,
          reservationId,
          tenantId,
          branch: "gil-puyat",
          violationType: "smoking_inside",
          penaltyApplied: 500,
          status: "penalty_issued",
          isArchived: false,
          save: jest.fn().mockResolvedValue(true),
        };
        mockFindByIdViolation.mockResolvedValue(mockViolationInstance);

        mockBillDoc = {
          _id: new mongoose.Types.ObjectId(),
          additionalCharges: [
            { name: `Violation Penalty: Smoking Inside (${violationShortId})`, amount: 500 },
          ],
          charges: { penalty: 500 },
          totalAmount: 5500,
          remainingAmount: 5500,
          save: mockBillSave.mockResolvedValue(true),
        };

        req.params = { id: violationId.toString() };
        req.body = {
          penaltyApplied: 300,
          penaltyReason: "Reduced penalty after explanation",
        };

        await updateViolation(req, res, next);

        expect(mockViolationInstance.penaltyApplied).toBe(300);
        expect(mockBillDoc.charges.penalty).toBe(300);
        expect(mockBillDoc.totalAmount).toBe(5300);
        expect(mockBillDoc.additionalCharges[0].amount).toBe(300);
        expect(mockBillSave).toHaveBeenCalled();
      });

      test("archiveViolation reverses penalty line-item on active monthly bill", async () => {
        const violationId = new mongoose.Types.ObjectId();
        const reservationId = new mongoose.Types.ObjectId();
        const tenantId = new mongoose.Types.ObjectId();
        const violationShortId = violationId.toString().slice(-6);

        const mockViolationInstance = {
          _id: violationId,
          reservationId,
          tenantId,
          branch: "gil-puyat",
          penaltyApplied: 500,
          isArchived: false,
          save: jest.fn().mockResolvedValue(true),
        };
        mockFindByIdViolation.mockResolvedValue(mockViolationInstance);

        mockBillDoc = {
          _id: new mongoose.Types.ObjectId(),
          additionalCharges: [
            { name: `Violation Penalty: Smoking Inside (${violationShortId})`, amount: 500 },
          ],
          charges: { penalty: 500 },
          totalAmount: 5500,
          remainingAmount: 5500,
          save: mockBillSave.mockResolvedValue(true),
        };

        req.params = { id: violationId.toString() };
        await archiveViolation(req, res, next);

        expect(mockViolationInstance.isArchived).toBe(true);
        expect(mockBillDoc.additionalCharges.length).toBe(0);
        expect(mockBillDoc.charges.penalty).toBe(0);
        expect(mockBillDoc.totalAmount).toBe(5000);
        expect(mockBillSave).toHaveBeenCalled();
      });
    });
  });
});

