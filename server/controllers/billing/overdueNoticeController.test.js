import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import mongoose from "mongoose";

const mockNoticeSave = jest.fn();
let mockNoticeDoc = null;
const mockBillSave = jest.fn();
let mockBillDoc = null;
const mockReviewSave = jest.fn();
let mockReviewDoc = null;

const mockFindBills = jest.fn();
const mockFindOneBill = jest.fn();
const mockFindByIdBill = jest.fn();

const mockFindNotices = jest.fn();
const mockFindOneNotice = jest.fn();

const mockFindReviews = jest.fn();
const mockFindOneReview = jest.fn();
const mockFindByIdReview = jest.fn();
const mockBillingNotice = jest.fn();

await jest.unstable_mockModule("../../models/index.js", () => {
  class MockOverdueNotice {
    constructor(data) {
      Object.assign(this, data);
      this._id = new mongoose.Types.ObjectId();
      this.delivery = {
        email: { status: "not_attempted" },
        notification: { status: "not_attempted" },
      };
      this.save = mockNoticeSave.mockResolvedValue(this);
    }
    static find = mockFindNotices;
    static findOne = mockFindOneNotice;
  }

  class MockTerminationReview {
    constructor(data) {
      Object.assign(this, data);
      this._id = new mongoose.Types.ObjectId();
      this.save = mockReviewSave.mockResolvedValue(this);
    }
    static find = mockFindReviews;
    static findOne = mockFindOneReview;
    static findById = mockFindByIdReview;
  }

  class MockBill {
    constructor(data) {
      Object.assign(this, data);
      this._id = new mongoose.Types.ObjectId();
      this.save = mockBillSave.mockResolvedValue(this);
    }
    static find = mockFindBills;
    static findOne = mockFindOneBill;
    static findById = mockFindByIdBill;
  }

  return {
    OverdueNotice: MockOverdueNotice,
    TerminationReview: MockTerminationReview,
    Bill: MockBill,
    Reservation: {
      find: jest.fn().mockReturnValue({ populate: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) }),
      findById: jest.fn().mockReturnValue({ populate: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(null) }),
    },
    Room: {
      find: jest.fn().mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) }),
    },
    User: {
      find: jest.fn().mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) }),
      findById: jest.fn().mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(null) }),
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          role: "admin",
          branch: "gil-puyat",
          firstName: "Admin",
          lastName: "Staff",
          email: "admin@lilycrest.com",
        }),
      }),
    },
    UtilityPeriod: {
      find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    },
    UtilityReading: {},
    TenantViolation: {},
    Notification: {},
    Payment: {},
    Contract: {},
    Stay: {},
    AuditLog: {},
    ROOM_BRANCHES: ["gil-puyat", "guadalupe"],
  };
});


await jest.unstable_mockModule("../../middleware/logger.js", () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

await jest.unstable_mockModule("../../utils/billingAudit.js", () => ({
  logBillingAudit: jest.fn().mockResolvedValue(true),
}));

await jest.unstable_mockModule("../../config/email.js", () => ({
  sendBillGeneratedEmail: jest.fn().mockResolvedValue({ success: true }),
  sendOverdueNoticeEmail: jest.fn().mockResolvedValue({ success: true }),
  sendPaymentApprovedEmail: jest.fn().mockResolvedValue({ success: true }),
  sendPaymentReminderEmail: jest.fn().mockResolvedValue({ success: true }),
  sendPaymentRejectedEmail: jest.fn().mockResolvedValue({ success: true }),
  sendUtilityChargeAvailableEmail: jest.fn().mockResolvedValue({ success: true }),
}));

await jest.unstable_mockModule("../../services/notifications/notificationService.js", () => {
  const notifyObj = {
    billingNotice: mockBillingNotice,
  };
  return {
    default: notifyObj,
    notify: notifyObj,
    createNotification: jest.fn().mockResolvedValue({ _id: new mongoose.Types.ObjectId() }),
  };
});


const {
  getOverdueNoticesAction,
  sendOverdueNoticeAction,
  updateTerminationDecisionAction,
} = await import("./overdueNoticeController.js");

describe("OverdueNoticeController Tests", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBillingNotice.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

    req = {
      user: {
        _id: new mongoose.Types.ObjectId(),
        uid: "test-admin-uid",
        role: "admin",
        branch: "gil-puyat",
      },
      branchFilter: "gil-puyat",
      params: {},
      body: {},
      query: {},
    };


    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  describe("getOverdueNoticesAction", () => {
    test("returns formatted overdue notice list with summary statistics", async () => {
      const mockBill = {
        _id: new mongoose.Types.ObjectId(),
        branch: "gil-puyat",
        userId: { _id: new mongoose.Types.ObjectId(), firstName: "John", lastName: "Doe" },
        roomId: { name: "Room 101" },
        remainingAmount: 5000,
        totalAmount: 5000,
        charges: { rent: 4500, penalty: 500 },
        dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        status: "overdue",
        overdueNoticeCount: 1,
      };

      mockFindBills.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockBill]),
      });

      mockFindNotices.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(),
            billId: mockBill._id,
            noticeNumber: 1,
            totalAmountAtIssuance: 5000,
            daysOverdueAtIssuance: 5,
            deliveryStatus: "sent",
            issuedAt: new Date(),
          },
        ]),
      });

      await getOverdueNoticesAction(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(1);
      expect(response.data[0].tenantName).toBe("John Doe");
      expect(response.data[0].noticeStage).toBe("notice_1");
      expect(response.stats.totalExposure).toBe(5000);
      expect(response.stats.notice1ActiveCount).toBe(1);
    });
  });

  describe("sendOverdueNoticeAction", () => {
    test("rejects notice dispatch if bill is under active dispute", async () => {
      const billId = new mongoose.Types.ObjectId();
      req.params.billId = billId;
      req.body = { noticeType: "notice_1" };

      mockFindByIdBill.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
      });
      // Resolve mock bill
      mockFindByIdBill.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue({
              _id: billId,
              branch: "gil-puyat",
              status: "overdue",
              remainingAmount: 5000,
              disputeState: "disputed",
              userId: { _id: new mongoose.Types.ObjectId(), email: "test@example.com" },
            }),
          }),
        }),
      });

      await sendOverdueNoticeAction(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("active administrative dispute"),
        }),
      );
    });

    test("enforces sequential notice progression (blocks N2 before N1)", async () => {
      const billId = new mongoose.Types.ObjectId();
      req.params.billId = billId;
      req.body = { noticeType: "notice_2" };

      mockFindByIdBill.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue({
              _id: billId,
              branch: "gil-puyat",
              status: "overdue",
              remainingAmount: 5000,
              disputeState: "none",
              overdueNoticeCount: 0, // No notices sent yet
              userId: { _id: new mongoose.Types.ObjectId(), email: "test@example.com" },
            }),
          }),
        }),
      });

      await sendOverdueNoticeAction(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("Sequential progression is required"),
        }),
      );
    });

    test("successfully dispatches Notice 1 with snapshot and email delivery", async () => {
      const billId = new mongoose.Types.ObjectId();
      req.params.billId = billId;
      req.body = { noticeType: "notice_1", noticeMessage: "Please pay promptly." };

      const billDoc = {
        _id: billId,
        branch: "gil-puyat",
        status: "overdue",
        remainingAmount: 4500,
        totalAmount: 4500,
        charges: { rent: 4500, penalty: 0 },
        disputeState: "none",
        overdueNoticeCount: 0,
        dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        userId: { _id: new mongoose.Types.ObjectId(), firstName: "Maria", lastName: "Clara", email: "maria@example.com" },
        save: mockBillSave.mockResolvedValue(true),
      };

      mockFindByIdBill.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(billDoc),
          }),
        }),
      });

      mockFindOneNotice.mockResolvedValue(null);

      await sendOverdueNoticeAction(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.overdueNoticeCount).toBe(1);
      expect(mockBillingNotice).toHaveBeenCalledWith(
        billDoc.userId._id,
        expect.objectContaining({
          notificationType: "bill_due_reminder",
          billId,
          eventId: expect.any(mongoose.Types.ObjectId),
          pushType: "overdue_notice",
        }),
      );
      expect(mockNoticeSave.mock.invocationCallOrder[0]).toBeLessThan(
        mockBillingNotice.mock.invocationCallOrder[0],
      );
    });

    test("auto-escalates to TerminationReview when Notice 3 Final is dispatched", async () => {
      const billId = new mongoose.Types.ObjectId();
      const reservationId = new mongoose.Types.ObjectId();
      req.params.billId = billId;
      req.body = { noticeType: "notice_3" };

      const billDoc = {
        _id: billId,
        reservationId,
        branch: "gil-puyat",
        status: "overdue",
        remainingAmount: 8500,
        totalAmount: 8500,
        charges: { rent: 7500, penalty: 1000 },
        disputeState: "none",
        overdueNoticeCount: 2, // Notice 2 already sent
        dueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        userId: { _id: new mongoose.Types.ObjectId(), firstName: "Crisostomo", lastName: "Ibarra", email: "ibarra@example.com" },
        save: mockBillSave.mockResolvedValue(true),
      };

      mockFindByIdBill.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(billDoc),
          }),
        }),
      });

      mockFindOneNotice.mockResolvedValue(null);
      mockFindOneReview.mockResolvedValue(null); // No active review yet

      await sendOverdueNoticeAction(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.escalatedToReviewId).toBeDefined();
    });
  });

  describe("updateTerminationDecisionAction", () => {
    test("requires non-empty outcomeDetail before adjudicating", async () => {
      req.params.id = new mongoose.Types.ObjectId();
      req.body = { outcome: "payment_plan_approved", outcomeDetail: "" };

      await updateTerminationDecisionAction(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("outcomeDetail"),
        }),
      );
    });

    test("successfully adjudicates payment plan with installments calculation", async () => {
      const reviewId = new mongoose.Types.ObjectId();
      req.params.id = reviewId;
      req.body = {
        outcome: "payment_plan_approved",
        outcomeDetail: "Approved 3-month payment arrangement.",
        paymentPlan: {
          totalAmount: 9000,
          numberOfInstallments: 3,
          installmentAmount: 3000,
          firstPaymentDue: new Date("2026-09-01"),
        },
      };

      const reviewDoc = {
        _id: reviewId,
        branch: "gil-puyat",
        tenantId: new mongoose.Types.ObjectId(),
        totalOutstandingAtOpen: 9000,
        status: "open",
        save: mockReviewSave.mockResolvedValue(true),
      };

      mockFindByIdReview.mockResolvedValue(reviewDoc);

      await updateTerminationDecisionAction(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(reviewDoc.decision.outcome).toBe("payment_plan_approved");
      expect(reviewDoc.paymentPlan.installments).toHaveLength(3);
    });
  });
});
