import { describe, it, expect, jest } from "@jest/globals";
import { z } from "zod";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  setRoleSchema,
  updateBranchSchema,
  createInquirySchema,
  createMaintenanceSchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
  overdueNoticeActionSchema,
  adjudicateViolationSchema,
} from "../validation/zodSchemas.js";

describe("validateRequest middleware", () => {
  const schema = {
    body: z.object({
      name: z.string().min(2),
      email: z.string().email(),
    }),
  };

  it("passes valid body data through to next()", async () => {
    const req = { body: { name: "Alice", email: "alice@example.com" } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await validateRequest(schema)(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.body).toEqual({ name: "Alice", email: "alice@example.com" });
  });

  it("returns 400 with VALIDATION_ERROR and details on invalid body", async () => {
    const req = { body: { name: "A", email: "invalid-email" }, id: "req-1" };
    const json = jest.fn();
    const res = { status: jest.fn().mockReturnValue({ json }), req };
    const next = jest.fn();

    await validateRequest(schema)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: expect.arrayContaining([
            expect.objectContaining({ field: "name" }),
            expect.objectContaining({ field: "email" }),
          ]),
        }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("handles query and params schemas validation and parsing", async () => {
    const customSchema = {
      params: z.object({
        id: z.string().min(1),
      }),
      query: z.object({
        page: z.coerce.number().min(1),
        limit: z.coerce.number().max(100),
      }),
    };

    const req = {
      params: { id: "123" },
      query: { page: "2", limit: "20" },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await validateRequest(customSchema)(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.query.page).toBe(2);
    expect(req.query.limit).toBe(20);
    expect(req.params.id).toBe("123");
  });

  it("returns 400 when query or params validation fails", async () => {
    const customSchema = {
      params: z.object({
        id: z.string().min(5, "ID too short"),
      }),
    };

    const req = { params: { id: "1" }, id: "req-2" };
    const json = jest.fn();
    const res = { status: jest.fn().mockReturnValue({ json }), req };
    const next = jest.fn();

    await validateRequest(customSchema)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
          details: expect.arrayContaining([
            expect.objectContaining({ field: "id", message: "ID too short" }),
          ]),
        }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards unexpected errors to next(error)", async () => {
    const unexpectedError = new Error("Database offline during transform");
    const badSchema = {
      body: {
        parseAsync: jest.fn().mockRejectedValue(unexpectedError),
      },
    };

    const req = { body: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await validateRequest(badSchema)(req, res, next);
    expect(next).toHaveBeenCalledWith(unexpectedError);
  });
});

describe("zodSchemas suite", () => {
  describe("setRoleSchema", () => {
    it("validates valid role assignment", () => {
      const result = setRoleSchema.safeParse({
        userId: "user-123",
        role: "branch_admin",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid role", () => {
      const result = setRoleSchema.safeParse({
        userId: "user-123",
        role: "super_admin",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateBranchSchema", () => {
    it("validates valid branches", () => {
      expect(updateBranchSchema.safeParse({ branch: "gil-puyat" }).success).toBe(true);
      expect(updateBranchSchema.safeParse({ branch: "guadalupe" }).success).toBe(true);
    });

    it("rejects invalid branch", () => {
      expect(updateBranchSchema.safeParse({ branch: "cubao" }).success).toBe(false);
    });
  });

  describe("createInquirySchema", () => {
    it("validates and trims valid inquiry payload", () => {
      const result = createInquirySchema.safeParse({
        name: "  Juan Dela Cruz  ",
        email: " juan@example.com ",
        phone: "+639123456789",
        subject: " Room Inquiry ",
        message: " I would like to inquire about availability. ",
        branch: "gil-puyat",
      });
      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Juan Dela Cruz");
      expect(result.data.email).toBe("juan@example.com");
      expect(result.data.subject).toBe("Room Inquiry");
    });

    it("rejects missing required fields", () => {
      const result = createInquirySchema.safeParse({
        name: "J",
        email: "not-an-email",
        subject: "Hi",
        message: "Hey",
        branch: "invalid",
      });
      expect(result.success).toBe(false);
      expect(result.error.issues.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("createMaintenanceSchema", () => {
    it("validates valid maintenance request", () => {
      const result = createMaintenanceSchema.safeParse({
        category: "plumbing",
        title: "Leaking Faucet",
        description: "The bathroom sink faucet is constantly dripping.",
      });
      expect(result.success).toBe(true);
    });

    it("rejects short title or description", () => {
      const result = createMaintenanceSchema.safeParse({
        category: "plumbing",
        title: "Hi",
        description: "Fix",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createAnnouncementSchema & updateAnnouncementSchema", () => {
    it("validates valid announcement payload with defaults", () => {
      const result = createAnnouncementSchema.safeParse({
        title: "Water Interruption Notice",
        content: "Maintenance scheduled on Saturday morning from 8 AM to 12 PM.",
        category: "maintenance",
      });
      expect(result.success).toBe(true);
      expect(result.data.contentType).toBe("announcement");
      expect(result.data.targetBranch).toBe("both");
      expect(result.data.visibility).toBe("tenants-only");
      expect(result.data.requiresAcknowledgment).toBe(false);
    });

    it("validates partial update announcement", () => {
      const result = updateAnnouncementSchema.safeParse({
        title: "Updated Notice Title",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("overdueNoticeActionSchema", () => {
    it("validates valid overdue notice payload", () => {
      const result = overdueNoticeActionSchema.safeParse({
        noticeStage: "notice_1",
        message: "Your monthly rent is 5 days overdue.",
        sendEmail: true,
        sendInApp: true,
        customPenalty: 300,
      });
      expect(result.success).toBe(true);
      expect(result.data.noticeStage).toBe("notice_1");
      expect(result.data.sendEmail).toBe(true);
      expect(result.data.customPenalty).toBe(300);
    });

    it("rejects negative customPenalty and excess message length", () => {
      const result = overdueNoticeActionSchema.safeParse({
        customPenalty: -100,
        message: "a".repeat(3001),
      });
      expect(result.success).toBe(false);
      expect(result.error.issues.some((i) => i.path.includes("customPenalty"))).toBe(true);
      expect(result.error.issues.some((i) => i.path.includes("message"))).toBe(true);
    });

    it("preserves noticeNumber, noticeType, and noticeMessage sent by frontend modal", () => {
      const result = overdueNoticeActionSchema.safeParse({
        noticeNumber: 1,
        noticeType: "notice_1",
        noticeMessage: "Please settle your outstanding balance at your earliest convenience.",
      });
      expect(result.success).toBe(true);
      expect(result.data.noticeNumber).toBe(1);
      expect(result.data.noticeType).toBe("notice_1");
      expect(result.data.noticeMessage).toBe("Please settle your outstanding balance at your earliest convenience.");
    });
  });

  describe("adjudicateViolationSchema", () => {
    it("validates valid adjudication payload", () => {
      const result = adjudicateViolationSchema.safeParse({
        decision: "confirmed",
        decisionReason: "Tenant confirmed noise violation on balcony after 11 PM.",
        targetStatus: "warning_issued",
        penaltyApplied: 0,
        chargeToBill: false,
      });
      expect(result.success).toBe(true);
      expect(result.data.decision).toBe("confirmed");
      expect(result.data.targetStatus).toBe("warning_issued");
    });

    it("rejects missing decisionReason", () => {
      const result = adjudicateViolationSchema.safeParse({
        decision: "confirmed",
        decisionReason: "",
      });
      expect(result.success).toBe(false);
      expect(result.error.issues.some((i) => i.path.includes("decisionReason"))).toBe(true);
    });
  });
});

