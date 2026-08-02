import { jest, describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import { createMilestoneSubInvoices } from "./milestoneInvoiceService.js";
import Bill from "../models/Bill.js";

describe("Milestone Invoice Service Tests", () => {
  let findByIdSpy;
  let findOneSpy;
  let createSpy;

  beforeEach(() => {
    findByIdSpy = jest.spyOn(Bill, "findById");
    findOneSpy = jest.spyOn(Bill, "findOne");
    createSpy = jest.spyOn(Bill, "create");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("rejects milestones if sum does not equal master invoice total exactly", async () => {
    const parentBill = {
      _id: "bill_123",
      totalAmount: 5000,
      status: "pending",
      notes: "Original Rent Bill",
      save: jest.fn(),
    };
    findByIdSpy.mockResolvedValue(parentBill);

    const milestones = [
      { amount: 2000, dueDate: "2026-08-05" },
      { amount: 2000, dueDate: "2026-08-20" },
    ];

    await expect(
      createMilestoneSubInvoices("bill_123", milestones, "admin_1")
    ).rejects.toThrow("must exactly equal the master bill total");
  });

  test("voids parent bill and creates milestone sub-invoices when sum matches exactly", async () => {
    const parentBill = {
      _id: "bill_123",
      reservationId: "res_1",
      userId: "user_1",
      branch: "Main",
      totalAmount: 5000,
      status: "pending",
      invoiceVersion: 1,
      notes: "Original Rent Bill",
      save: jest.fn().mockResolvedValue(true),
    };
    findByIdSpy.mockResolvedValue(parentBill);
    createSpy.mockImplementation((data) => Promise.resolve({ ...data, _id: "sub_" + data.milestoneIndex }));

    const milestones = [
      { amount: 2500, dueDate: "2026-08-05" },
      { amount: 2500, dueDate: "2026-08-20" },
    ];

    const result = await createMilestoneSubInvoices("bill_123", milestones, "admin_1");

    expect(parentBill.status).toBe("voided");
    expect(parentBill.save).toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result[0].totalAmount).toBe(2500);
    expect(result[0].isMilestoneSubInvoice).toBe(true);
    expect(result[0].milestoneIndex).toBe(1);
    expect(result[1].milestoneIndex).toBe(2);
  });

  test("rechecks the authorized branch before any Bill mutation", async () => {
    findOneSpy.mockResolvedValue(null);
    const milestones = [
      { amount: 2500, dueDate: "2026-08-05" },
      { amount: 2500, dueDate: "2026-08-20" },
    ];

    await expect(
      createMilestoneSubInvoices("bill_123", milestones, "admin_1", {
        expectedBranch: "gil-puyat",
      }),
    ).rejects.toMatchObject({ code: "BILL_BRANCH_MISMATCH", statusCode: 409 });

    expect(findOneSpy).toHaveBeenCalledWith(expect.objectContaining({
      _id: "bill_123",
      branch: "gil-puyat",
    }));
    expect(createSpy).not.toHaveBeenCalled();
  });
});
