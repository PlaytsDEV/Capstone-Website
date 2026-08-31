import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const genericModel = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  create: jest.fn(),
  insertMany: jest.fn(),
  countDocuments: jest.fn(),
  exists: jest.fn(),
  save: jest.fn(),
  lean: jest.fn(),
  sort: jest.fn(),
});

const applianceModel = genericModel();
const auditLogModel = genericModel();
const reservationModel = genericModel();

const allModels = {
  Appliance: applianceModel,
  AuditLog: auditLogModel,
  Reservation: reservationModel,
  User: genericModel(),
  Room: genericModel(),
  Bill: genericModel(),
};

await jest.unstable_mockModule("../models/index.js", () => allModels);
await jest.unstable_mockModule("../middleware/logger.js", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
  getAppliances,
  createAppliance,
  updateAppliance,
  deleteAppliance,
} = await import("./applianceController.js");

describe("Appliance Controller (TDD)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAppliances", () => {
    test("seeds defaults and returns active appliances when catalog is empty", async () => {
      const seededList = [
        { _id: "app1", name: "Electric Fan", code: "fan", monthlyFee: 200, category: "cooling", maxQuantity: 5, isActive: true },
        { _id: "app2", name: "Rice Cooker", code: "ricecooker", monthlyFee: 200, category: "cooking", maxQuantity: 2, isActive: true },
        { _id: "app3", name: "Laptop", code: "laptop", monthlyFee: 200, category: "electronics", maxQuantity: 3, isActive: true },
      ];
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(seededList),
      };
      applianceModel.countDocuments.mockResolvedValue(0);
      applianceModel.insertMany.mockResolvedValue(seededList);
      applianceModel.find.mockReturnValue(mockQuery);

      const req = { query: {} };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await getAppliances(req, res);

      expect(applianceModel.countDocuments).toHaveBeenCalled();
      expect(applianceModel.insertMany).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ code: "fan", name: "Electric Fan" }),
          ]),
        })
      );
    });

    test("returns all appliances including inactive when includeInactive=true", async () => {
      applianceModel.countDocuments.mockResolvedValue(3);
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          { _id: "app1", name: "Electric Fan", code: "fan", monthlyFee: 200, isActive: true },
          { _id: "app2", name: "Heater", code: "heater", monthlyFee: 300, isActive: false },
        ]),
      };
      applianceModel.find.mockReturnValue(mockQuery);

      const req = { query: { includeInactive: "true" } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await getAppliances(req, res);

      expect(applianceModel.find).toHaveBeenCalledWith({});
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
        })
      );
    });
  });

  describe("createAppliance", () => {
    test("rejects when name or monthlyFee is missing or negative", async () => {
      const req = {
        body: { name: "", monthlyFee: -50 },
        user: { _id: "507f1f77bcf86cd799439011", email: "admin@lilycrest.com", role: "branch_admin" },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await createAppliance(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: "VALIDATION_ERROR",
        })
      );
    });

    test("rejects purely numeric appliance name", async () => {
      const req = {
        body: { name: "1231231231", monthlyFee: 200 },
        user: { _id: "507f1f77bcf86cd799439011" },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await createAppliance(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: "VALIDATION_ERROR",
        })
      );
    });

    test("rejects monthly fee exceeding ₱5,000 or not multiple of 10", async () => {
      const req = {
        body: { name: "Air Conditioner", monthlyFee: 6000 },
        user: { _id: "507f1f77bcf86cd799439011" },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await createAppliance(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: "VALIDATION_ERROR",
        })
      );
    });

    test("rejects max quantity exceeding 10 units", async () => {
      const req = {
        body: { name: "Kettle", monthlyFee: 100, maxQuantity: 15 },
        user: { _id: "507f1f77bcf86cd799439011" },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await createAppliance(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: "VALIDATION_ERROR",
        })
      );
    });

    test("rejects when appliance code or name already exists", async () => {
      const req = {
        body: { name: "Electric Fan", monthlyFee: 200 },
        user: { _id: "507f1f77bcf86cd799439011", email: "admin@lilycrest.com", role: "branch_admin" },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      applianceModel.findOne.mockResolvedValue({ _id: "existing_id", name: "Electric Fan", code: "electric-fan" });

      await createAppliance(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: "APPLIANCE_ALREADY_EXISTS",
        })
      );
    });

    test("successfully creates appliance, normalizes code slug, and logs audit", async () => {
      const req = {
        body: {
          name: "Mini Refrigerator",
          monthlyFee: 500,
          category: "cooling",
          maxQuantity: 1,
          description: "Compact single door bar fridge",
        },
        user: { _id: "507f1f77bcf86cd799439011", email: "admin@lilycrest.com", role: "branch_admin" },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      applianceModel.findOne.mockResolvedValue(null);
      const createdRecord = {
        _id: "507f1f77bcf86cd799439099",
        name: "Mini Refrigerator",
        code: "mini-refrigerator",
        monthlyFee: 500,
        category: "cooling",
        maxQuantity: 1,
        description: "Compact single door bar fridge",
        isActive: true,
      };
      applianceModel.create.mockResolvedValue(createdRecord);

      await createAppliance(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(applianceModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Mini Refrigerator",
          code: "mini-refrigerator",
          monthlyFee: 500,
          category: "cooling",
        })
      );
      expect(auditLogModel.create).toHaveBeenCalled();
    });
  });

  describe("updateAppliance", () => {
    test("rejects invalid appliance ID", async () => {
      const req = {
        params: { id: "invalid-id" },
        body: { monthlyFee: 250 },
        user: { _id: "507f1f77bcf86cd799439011", email: "admin@lilycrest.com", role: "branch_admin" },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await updateAppliance(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: "INVALID_APPLIANCE_ID",
        })
      );
    });

    test("successfully updates appliance fee and status", async () => {
      const validId = "507f1f77bcf86cd799439011";
      const existing = {
        _id: validId,
        name: "Electric Fan",
        code: "fan",
        monthlyFee: 200,
        category: "cooling",
        maxQuantity: 5,
        isActive: true,
        save: jest.fn().mockResolvedValue(true),
      };
      applianceModel.findById.mockResolvedValue(existing);

      const req = {
        params: { id: validId },
        body: { monthlyFee: 250, isActive: true },
        user: { _id: "507f1f77bcf86cd799439011", email: "admin@lilycrest.com", role: "branch_admin" },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await updateAppliance(req, res);

      expect(existing.monthlyFee).toBe(250);
      expect(existing.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("updated"),
        })
      );
      expect(auditLogModel.create).toHaveBeenCalled();
    });
  });

  describe("deleteAppliance", () => {
    test("soft-deletes appliance by setting isActive to false", async () => {
      const validId = "507f1f77bcf86cd799439011";
      const existing = {
        _id: validId,
        name: "Old Microwave",
        code: "old-microwave",
        isActive: true,
        save: jest.fn().mockResolvedValue(true),
      };
      applianceModel.findById.mockResolvedValue(existing);

      const req = {
        params: { id: validId },
        user: { _id: "507f1f77bcf86cd799439011", email: "admin@lilycrest.com", role: "branch_admin" },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await deleteAppliance(req, res);

      expect(existing.isActive).toBe(false);
      expect(existing.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("archived"),
        })
      );
      expect(auditLogModel.create).toHaveBeenCalled();
    });
  });
});
