import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const records = {
  user: null,
  reservation: null,
  room: null,
  stay: null,
};

const query = (key) => ({
  lean: jest.fn().mockImplementation(async () => records[key]),
});

await jest.unstable_mockModule("../models/index.js", () => ({
  User: { findById: jest.fn(() => query("user")) },
  Reservation: { findById: jest.fn(() => query("reservation")) },
  Room: { findById: jest.fn(() => query("room")) },
  Stay: { findById: jest.fn(() => query("stay")) },
}));

const { buildContractGenerationData, resolveContractExecutionDate } =
  await import("./contractGenerationDataService.js");

const contract = () => ({
  tenantId: "tenant-1",
  reservationId: "reservation-1",
  roomId: "room-1",
  stayId: "stay-1",
  branch: "gil-puyat",
  roomType: "private",
  leaseType: "short_term",
  leaseStartDate: new Date("2026-01-01T00:00:00.000Z"),
  leaseEndDate: new Date("2026-02-01T00:00:00.000Z"),
  leaseDurationMonths: 1,
  executionDate: new Date("2026-01-01T00:00:00.000Z"),
  bedId: "fallback-bed",
  bedLabel: "fallback-label",
  regularMonthlyRate: 16000,
  discountPercentage: 10,
  discountAmount: 1600,
  approvedMonthlyRate: 14400,
  advanceRentAmount: 14400,
  securityDepositAmount: 14400,
  reservationFeeAmount: 2000,
  reservationFeeCreditAmount: 2000,
  pricingApprovalId: "reservation-1",
  pricingApprovedBy: "admin-1",
  pricingApprovedAt: new Date("2025-12-20"),
  advanceCoverageStart: new Date("2026-01-01T00:00:00.000Z"),
  advanceCoverageEnd: new Date("2026-02-01T00:00:00.000Z"),
});

beforeEach(() => {
  records.user = {
    _id: "tenant-1",
    firstName: "Canonical",
    lastName: "Tenant",
    email: "canonical@example.com",
    phone: "09170000000",
    nationality: "Filipino",
    address: "Canonical Address",
    dateOfBirth: new Date("2000-01-01"),
    validIDFrontUrl: "/secret/id.jpg",
  };
  records.reservation = {
    _id: "reservation-1",
    userId: "tenant-1",
    roomId: "room-1",
    status: "reserved",
    applicationReviewedAt: new Date("2025-12-19"),
    applicationReviewedBy: "admin-1",
    firstName: "Application",
    lastName: "Fallback",
    billingEmail: "fallback@example.com",
    mobileNumber: "09990000000",
    nationality: "Filipino",
    birthday: new Date("1999-01-01"),
    address: { unitHouseNo: "1", street: "Fallback Street", city: "Makati" },
    validIDFrontUrl: "/secret/reservation-id.jpg",
    reservationFeeAmount: 2000,
    paymentStatus: "partial",
  };
  records.room = {
    _id: "room-1",
    branch: "gil-puyat",
    type: "private",
    roomNumber: "101",
  };
  records.stay = {
    _id: "stay-1",
    reservationId: "reservation-1",
    branch: "gil-puyat",
    roomId: "room-1",
    bedId: "bed-1",
    bedCode: "101-A",
  };
});

describe("Contract generation-data mapping", () => {
  test("maps the approved execution date into separate introductory-clause fields", async () => {
    const input = contract();
    input.executionDate = new Date("2026-01-27T00:00:00.000Z");
    const data = await buildContractGenerationData(input, { verifyTemplate: false });
    expect(data.fields).toEqual(expect.objectContaining({
      contractExecutionDay: "27th",
      contractExecutionMonth: "January",
      contractExecutionYear: "2026",
    }));
    expect(data.lease.executionDateSource).toBe("admin_approved");
  });

  test("initial generation date is the one-time fallback execution date", () => {
    const input = contract();
    input.executionDate = null;
    const generationDate = new Date("2026-01-27T12:00:00.000Z");
    expect(resolveContractExecutionDate(input, { generationDate })).toEqual({
      value: generationDate,
      source: "initial_generation",
    });
  });

  test("invalid or post-lease execution dates are rejected", () => {
    expect(() => resolveContractExecutionDate({
      ...contract(), executionDate: "not-a-date",
    })).toThrow(expect.objectContaining({ code: "CONTRACT_EXECUTION_DATE_INVALID" }));
    expect(() => resolveContractExecutionDate({
      ...contract(), executionDate: new Date("2026-02-02T00:00:00.000Z"),
    })).toThrow(expect.objectContaining({ code: "CONTRACT_EXECUTION_DATE_CONFLICT" }));
  });

  test("uses verified approved Application values before profile fallbacks", async () => {
    const data = await buildContractGenerationData(contract(), { verifyTemplate: false });
    expect(data.tenant).toEqual(expect.objectContaining({
      tenantLegalName: "Application Fallback",
      tenantAddress: "1, Fallback Street, Makati",
      tenantEmail: "fallback@example.com",
      tenantPhone: "09990000000",
    }));
  });

  test("properly formats applicant form address and excludes administrative region", async () => {
    records.reservation.address = {
      unitHouseNo: "Unit 1204 Tower A",
      street: "SMDC JAZZ RESIDENCES",
      barangay: "Bel-Air",
      city: "City of Makati",
      province: "",
      region: "National Capital Region (NCR)",
    };
    const data = await buildContractGenerationData(contract(), { verifyTemplate: false });
    expect(data.tenant.tenantAddress).toBe(
      "Unit 1204 Tower A, SMDC JAZZ RESIDENCES, Bel-Air, City of Makati",
    );
    expect(data.fields.tenantResidentialAddress).toBe(
      "Unit 1204 Tower A, SMDC JAZZ RESIDENCES, Bel-Air, City of Makati",
    );
  });

  test("strips legacy administrative region suffix from existing contract address snapshot", async () => {
    const input = {
      ...contract(),
      tenantAddress:
        "SMDC JAZZ RESIDENCES, Bel-Air, City of Makati, National Capital Region (NCR)",
    };
    const data = await buildContractGenerationData(input, { verifyTemplate: false });
    expect(data.tenant.tenantAddress).toBe(
      "SMDC JAZZ RESIDENCES, Bel-Air, City of Makati",
    );
    expect(data.fields.tenantResidentialAddress).toBe(
      "SMDC JAZZ RESIDENCES, Bel-Air, City of Makati",
    );
  });

  test("contract generation data is exclusive to applicant application and ignores User profile mutations", async () => {
    records.user.firstName = "Mutated In User Profile";
    records.user.lastName = "Account";
    records.user.address = "999 Irrelevant User Street";
    records.user.phone = "09888888888";
    records.user.email = "mutated@userprofile.com";
    records.user.dateOfBirth = new Date("1980-05-05");

    const data = await buildContractGenerationData(contract(), { verifyTemplate: false });
    expect(data.tenant.tenantLegalName).toBe("Application Fallback");
    expect(data.tenant.tenantAddress).toBe("1, Fallback Street, Makati");
    expect(data.tenant.tenantEmail).toBe("fallback@example.com");
    expect(data.tenant.tenantPhone).toBe("09990000000");
    expect(data.tenant.tenantBirthDate).toEqual(new Date("1999-01-01"));
  });

  test("persisted contract snapshot fields take absolute precedence", async () => {
    const input = {
      ...contract(),
      tenantLegalName: "Stored Snapshot Name",
      tenantAddress: "Stored Snapshot Address",
      tenantEmail: "stored@snapshot.com",
      tenantPhone: "09111111111",
      tenantNationality: "Filipino",
      tenantBirthDate: new Date("1995-10-10"),
    };
    const data = await buildContractGenerationData(input, { verifyTemplate: false });
    expect(data.tenant.tenantLegalName).toBe("Stored Snapshot Name");
    expect(data.tenant.tenantAddress).toBe("Stored Snapshot Address");
    expect(data.tenant.tenantEmail).toBe("stored@snapshot.com");
    expect(data.tenant.tenantPhone).toBe("09111111111");
    expect(data.tenant.tenantBirthDate).toEqual(new Date("1995-10-10"));
  });

  test("resolves Room and active assignment from backend records", async () => {
    const data = await buildContractGenerationData(contract(), { verifyTemplate: false });
    expect(data.assignment).toEqual({
      roomId: "room-1",
      roomNumber: "101",
      roomType: "private",
      bedId: "bed-1",
      bedLabel: "101-A",
    });
    expect(data.template.templateId).toBe("private-short-term");
  });

  test.each([
    ["gil-puyat", "LILYCREST GIL PUYAT", "#7 Gil Puyat Ave. corner Marconi St., Makati City"],
    ["guadalupe", "LILYCREST GUADALUPE", "9431 Magallanes Street, 1212 Makati, Metro Manila"],
  ])("maps verified %s property configuration", async (branch, name, address) => {
    records.room.branch = branch;
    records.room.type = branch === "guadalupe" ? "quadruple-sharing" : "private";
    records.stay.branch = branch;
    const input = { ...contract(), branch, roomType: records.room.type };
    const data = await buildContractGenerationData(input, { verifyTemplate: false });
    expect(data.property).toEqual(expect.objectContaining({
      propertyName: name,
      propertyAddress: address,
    }));
  });

  test("keeps every notarial field blank", async () => {
    const data = await buildContractGenerationData(contract(), { verifyTemplate: false });
    expect(data.notarialFields.shouldRemainBlank).toBe(true);
    for (const [field, value] of Object.entries(data.notarialFields)) {
      if (field !== "shouldRemainBlank") expect(value).toBe("");
    }
  });

  test("does not expose identity-document URLs or unrelated application data", async () => {
    const data = await buildContractGenerationData(contract(), { verifyTemplate: false });
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("validIDFrontUrl");
    expect(serialized).not.toContain("/secret/");
  });

  test("actual Room type is authoritative over Contract or frontend values", async () => {
    records.room.type = "double-sharing";
    const input = { ...contract(), roomType: "double-sharing" };
    await expect(buildContractGenerationData(input, { verifyTemplate: false }))
      .resolves.toEqual(expect.objectContaining({
        template: expect.objectContaining({ templateId: "double-sharing-short-term" }),
        assignment: expect.objectContaining({ roomType: "double-sharing" }),
      }));
    await expect(buildContractGenerationData(input, {
      verifyTemplate: false,
      requestedTemplateId: "private-short-term",
    })).rejects.toEqual(expect.objectContaining({ code: "CONTRACT_TEMPLATE_MISMATCH" }));
  });

  test("rejects an actual Room from another branch", async () => {
    records.room.branch = "guadalupe";
    records.room.type = "quadruple-sharing";
    await expect(buildContractGenerationData(contract(), { verifyTemplate: false }))
      .rejects.toEqual(expect.objectContaining({ code: "CONTRACT_BRANCH_CONFLICT" }));
  });

  test("accepts a completed legacy moved-in Reservation with verified evidence", async () => {
    records.reservation.status = "moveIn";
    records.reservation.applicationReviewedAt = null;
    records.reservation.applicationReviewedBy = null;
    records.reservation.moveInDate = new Date("2026-01-01");
    records.reservation.selectedBed = { id: "bed-1" };
    records.reservation.paymentStatus = "paid";
    const data = await buildContractGenerationData(contract(), { verifyTemplate: false });
    expect(data.reservationEligibility).toMatchObject({
      eligible: true,
      approvalState: "legacy_completed",
      legacyCompatibilityApplied: true,
    });
  });

  describe("structured-workflow reservation-fee verification", () => {
    beforeEach(() => {
      // A structured reservation never writes the legacy paymentStatus field —
      // left at its unrelated default to prove it no longer gates generation.
      records.reservation.financialWorkflowVersion = "structured-initial-payment-v1";
      records.reservation.reservationFeePaymentStatus = "verified";
      records.reservation.paymentStatus = "pending";
    });

    test("a verified structured reservation fee does not block pricing validation", async () => {
      const data = await buildContractGenerationData(contract(), { verifyTemplate: false });
      expect(data.pricingValidation.errors).not.toContainEqual(
        expect.objectContaining({ code: "RESERVATION_FEE_PAYMENT_NOT_VERIFIED" }),
      );
    });

    test("a pending structured reservation fee still blocks pricing validation", async () => {
      records.reservation.reservationFeePaymentStatus = "pending";
      const data = await buildContractGenerationData(contract(), { verifyTemplate: false });
      expect(data.pricingValidation.errors).toContainEqual(
        expect.objectContaining({ code: "RESERVATION_FEE_PAYMENT_NOT_VERIFIED" }),
      );
    });
  });
});
