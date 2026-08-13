import { jest } from "@jest/globals";
import mongoose from "mongoose";

describe("autoContractOrchestratorService", () => {
  let autoGenerateMoveInContract;
  let autoGenerateTransferContract;
  let mockContractFindOne;
  let mockReservationFindById;
  let mockUserFindById;
  let mockCreateDraftContract;
  let mockCreateReplacementContractForTransfer;
  let mockValidateContractForGeneration;
  let mockTransitionContract;
  let mockGeneratePreparedContractPdf;

  beforeEach(async () => {
    jest.resetModules();

    mockContractFindOne = jest.fn();
    mockReservationFindById = jest.fn();
    mockUserFindById = jest.fn();
    mockCreateDraftContract = jest.fn();
    mockCreateReplacementContractForTransfer = jest.fn();
    mockValidateContractForGeneration = jest.fn().mockResolvedValue({
      valid: true,
      status: "ready_for_generation",
      template: { templateId: "tpl1", templateVersion: 1, legalContentVersion: 1 },
      generationData: { pricing: { approvedMonthlyRate: 6000 } },
    });
    mockTransitionContract = jest.fn().mockImplementation(async (c, s) => {
      c.status = s;
      return c;
    });
    mockGeneratePreparedContractPdf = jest.fn();

    jest.unstable_mockModule("../models/index.js", () => ({
      Contract: {
        findOne: mockContractFindOne,
      },
      Reservation: {
        findById: mockReservationFindById,
      },
      User: {
        findById: mockUserFindById,
      },
      Room: {
        findById: jest.fn(),
      },
    }));

    jest.unstable_mockModule("./contractService.js", () => ({
      createDraftContract: mockCreateDraftContract,
      createReplacementContractForTransfer: mockCreateReplacementContractForTransfer,
      validateContractForGeneration: mockValidateContractForGeneration,
      transitionContract: mockTransitionContract,
    }));

    jest.unstable_mockModule("./contractPdfService.js", () => ({
      generatePreparedContractPdf: mockGeneratePreparedContractPdf,
    }));

    jest.unstable_mockModule("../utils/notificationService.js", () => ({
      notify: {},
      notifyBranchAdmins: jest.fn().mockResolvedValue([]),
    }));

    const mod = await import("./autoContractOrchestratorService.js");
    autoGenerateMoveInContract = mod.autoGenerateMoveInContract;
    autoGenerateTransferContract = mod.autoGenerateTransferContract;
  });

  describe("autoGenerateMoveInContract", () => {
    test("creates a draft contract, validates it, and generates PDF when no contract exists", async () => {
      const resId = new mongoose.Types.ObjectId();
      const contractId = new mongoose.Types.ObjectId();
      const actorId = new mongoose.Types.ObjectId();

      mockReservationFindById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: resId, roomId: "room123", currentStayId: "stay123" }),
      });
      mockContractFindOne.mockResolvedValueOnce(null);

      const createdDraft = {
        _id: contractId,
        contractNumber: "LIL-MNL-2026-00001",
        status: "draft",
        branch: "manila",
        roomNumber: "101",
        tenantId: "tenant123",
        save: jest.fn().mockResolvedValue(true),
      };
      mockCreateDraftContract.mockResolvedValue(createdDraft);
      mockGeneratePreparedContractPdf.mockResolvedValue({
        contract: { ...createdDraft, status: "generated" },
      });
      mockUserFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ firstName: "Juan", lastName: "Dela Cruz" }),
        }),
      });

      const result = await autoGenerateMoveInContract({ reservationId: resId, actorId });

      expect(result.success).toBe(true);
      expect(mockCreateDraftContract).toHaveBeenCalledWith(
        expect.objectContaining({ reservationId: resId, actorId }),
      );
      expect(mockGeneratePreparedContractPdf).toHaveBeenCalledWith(
        expect.objectContaining({ contractId }),
      );
    });

    test("generates PDF for an existing ready_for_generation draft without recreating it", async () => {
      const resId = new mongoose.Types.ObjectId();
      const contractId = new mongoose.Types.ObjectId();
      const actorId = new mongoose.Types.ObjectId();

      mockReservationFindById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: resId }),
      });
      const existingDraft = {
        _id: contractId,
        contractNumber: "LIL-MNL-2026-00002",
        status: "ready_for_generation",
        branch: "manila",
        roomNumber: "102",
        tenantId: "tenant123",
        save: jest.fn().mockResolvedValue(true),
      };
      mockContractFindOne.mockResolvedValueOnce(existingDraft);
      mockGeneratePreparedContractPdf.mockResolvedValue({
        contract: { ...existingDraft, status: "generated" },
      });
      mockUserFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ firstName: "Maria", lastName: "Santos" }),
        }),
      });

      const result = await autoGenerateMoveInContract({ reservationId: resId, actorId });

      expect(result.success).toBe(true);
      expect(mockCreateDraftContract).not.toHaveBeenCalled();
      expect(mockGeneratePreparedContractPdf).toHaveBeenCalledWith(
        expect.objectContaining({ contractId }),
      );
    });

    test("handles PDF generation errors gracefully without throwing", async () => {
      const resId = new mongoose.Types.ObjectId();
      const contractId = new mongoose.Types.ObjectId();

      mockReservationFindById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: resId }),
      });
      mockContractFindOne.mockResolvedValueOnce({
        _id: contractId,
        status: "ready_for_generation",
        save: jest.fn().mockResolvedValue(true),
      });
      mockGeneratePreparedContractPdf.mockRejectedValue(new Error("Font render failure"));

      const result = await autoGenerateMoveInContract({ reservationId: resId, actorId: "admin123" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Font render failure");
    });
  });

  describe("autoGenerateTransferContract", () => {
    test("supersedes old contract, creates replacement, validates, and generates PDF", async () => {
      const resId = new mongoose.Types.ObjectId();
      const oldContractId = new mongoose.Types.ObjectId();
      const replacementId = new mongoose.Types.ObjectId();
      const actorId = new mongoose.Types.ObjectId();

      const oldContract = {
        _id: oldContractId,
        contractNumber: "LIL-MNL-2026-00001",
        version: 1,
        status: "active",
        stayId: "stay123",
        roomNumber: "101",
      };

      mockContractFindOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          _id: oldContractId,
          ...oldContract,
        }),
      });

      const replacementDoc = {
        _id: replacementId,
        contractNumber: "LIL-MNL-2026-00005",
        version: 2,
        status: "draft",
        branch: "manila",
        roomNumber: "205",
        tenantId: "tenant123",
        save: jest.fn().mockResolvedValue(true),
      };

      mockCreateReplacementContractForTransfer.mockResolvedValue(replacementDoc);
      mockGeneratePreparedContractPdf.mockResolvedValue({
        contract: { ...replacementDoc, status: "generated" },
      });
      mockUserFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ firstName: "Juan", lastName: "Dela Cruz" }),
        }),
      });

      const result = await autoGenerateTransferContract({
        reservationId: resId,
        activeStay: { _id: "stay123" },
        targetRoom: { _id: "room205", roomNumber: "205", branch: "manila", monthlyPrice: 8000 },
        targetBed: { id: "bedB", label: "Bed B" },
        effectiveTransferDate: new Date(),
        actorId,
      });

      expect(result.success).toBe(true);
      expect(result.replacementContractId).toBe(String(replacementId));
      expect(mockCreateReplacementContractForTransfer).toHaveBeenCalled();
      expect(mockGeneratePreparedContractPdf).toHaveBeenCalledWith(
        expect.objectContaining({ contractId: replacementId }),
      );
    });
  });
});
