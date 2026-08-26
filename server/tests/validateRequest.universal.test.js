import { describe, it, expect, jest } from "@jest/globals";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  updateUserSchema,
  createRoomSchema,
  updateRoomSchema,
  createViolationSchema,
} from "../validation/zodSchemas.js";

describe("Universal Zod Validation Suite", () => {
  describe("updateUserSchema", () => {
    it("validates valid user update data", () => {
      const result = updateUserSchema.safeParse({
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phone: "09171234567",
        gender: "male",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const result = updateUserSchema.safeParse({
        email: "not-an-email",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createRoomSchema & updateRoomSchema", () => {
    it("validates valid room creation", () => {
      const result = createRoomSchema.safeParse({
        roomNumber: "101",
        branch: "gil-puyat",
        type: "quadruple-sharing",
        capacity: 4,
        baseRate: 4500,
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid room capacity or branch", () => {
      const result = createRoomSchema.safeParse({
        roomNumber: "101",
        branch: "invalid-branch",
        type: "private",
        capacity: -1,
      });
      expect(result.success).toBe(false);
    });

    it("validates partial room updates", () => {
      const result = updateRoomSchema.safeParse({
        baseRate: 5000,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("createViolationSchema", () => {
    it("validates valid violation payload with defaults", () => {
      const result = createViolationSchema.safeParse({
        tenantId: "tenant-123",
        violationType: "noise",
        description: "Loud party past quiet hours after midnight",
      });
      expect(result.success).toBe(true);
      expect(result.data.severity).toBe("minor");
      expect(result.data.penaltyAmount).toBe(0);
    });

    it("rejects missing tenantId or short description", () => {
      const result = createViolationSchema.safeParse({
        violationType: "noise",
        description: "bad",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("validateRequest middleware integration with new schemas", () => {
    it("passes through valid room request to next()", async () => {
      const req = {
        body: {
          roomNumber: "201",
          branch: "guadalupe",
          type: "double-sharing",
          capacity: 2,
        },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await validateRequest({ body: createRoomSchema })(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("blocks invalid room request with 400 VALIDATION_ERROR", async () => {
      const req = {
        body: {
          roomNumber: "",
          branch: "unknown",
        },
        id: "req-room-err",
      };
      const json = jest.fn();
      const res = { status: jest.fn().mockReturnValue({ json }), req };
      const next = jest.fn();

      await validateRequest({ body: createRoomSchema })(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
