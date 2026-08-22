import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// Unlike contractGenerationDataService.test.js (which mocks a single global
// fixture per model, ignoring the id passed to findById), this suite mocks
// TWO distinct tenants keyed by their actual id, so buildContractGenerationData
// is forced to do a real per-contract lookup. This is the only way to catch
// cross-tenant contamination bugs: shared mutable generation state, stale
// caching, or template-object reuse would leak Tenant B's data into Tenant
// A's payload (or vice versa) — a single-fixture mock can never observe that,
// because there would be nothing else to leak from.
const usersById = {};
const reservationsById = {};
const roomsById = {};
const staysById = {};

const byId = (table) => (id) => ({
  lean: jest.fn().mockImplementation(async () => table[id] ?? null),
});

await jest.unstable_mockModule("../models/index.js", () => ({
  User: { findById: jest.fn((id) => byId(usersById)(id)) },
  Reservation: { findById: jest.fn((id) => byId(reservationsById)(id)) },
  Room: { findById: jest.fn((id) => byId(roomsById)(id)) },
  Stay: { findById: jest.fn((id) => byId(staysById)(id)) },
}));

const { buildContractGenerationData } = await import("./contractGenerationDataService.js");

const buildTenantFixture = ({ suffix, roomType, address, rate }) => {
  const tenantId = `tenant-${suffix}`;
  const reservationId = `reservation-${suffix}`;
  const roomId = `room-${suffix}`;
  const stayId = `stay-${suffix}`;

  usersById[tenantId] = {
    _id: tenantId,
    firstName: `Live${suffix.toUpperCase()}`,
    lastName: "ProfileOnly",
  };
  reservationsById[reservationId] = {
    _id: reservationId,
    userId: tenantId,
    roomId,
    status: "reserved",
    applicationReviewedAt: new Date("2025-12-19"),
    applicationReviewedBy: "admin-1",
    firstName: `Tenant`,
    lastName: suffix.toUpperCase(),
    billingEmail: `tenant-${suffix}@example.com`,
    mobileNumber: `0917${suffix === "a" ? "1111111" : "2222222"}`,
    nationality: "Filipino",
    birthday: new Date("1999-01-01"),
    address,
    reservationFeeAmount: 2000,
    paymentStatus: "partial",
  };
  roomsById[roomId] = {
    _id: roomId,
    branch: "gil-puyat",
    type: roomType,
    roomNumber: suffix === "a" ? "101" : "202",
  };
  staysById[stayId] = {
    _id: stayId,
    reservationId,
    branch: "gil-puyat",
    roomId,
    bedId: `bed-${suffix}`,
    bedCode: `${suffix === "a" ? "101" : "202"}-A`,
  };

  return {
    tenantId,
    reservationId,
    roomId,
    stayId,
    branch: "gil-puyat",
    roomType,
    leaseType: "short_term",
    leaseStartDate: new Date(suffix === "a" ? "2026-01-01T00:00:00.000Z" : "2026-03-01T00:00:00.000Z"),
    leaseEndDate: new Date(suffix === "a" ? "2026-02-01T00:00:00.000Z" : "2026-04-01T00:00:00.000Z"),
    leaseDurationMonths: 1,
    executionDate: new Date("2026-01-01T00:00:00.000Z"),
    bedId: "",
    bedLabel: "",
    regularMonthlyRate: rate.regular,
    discountPercentage: rate.discountPercentage,
    discountType: "percentage",
    discountAmount: rate.discountAmount,
    approvedMonthlyRate: rate.approved,
    advanceRentAmount: rate.advance,
    securityDepositAmount: rate.deposit,
    reservationFeeAmount: 2000,
    reservationFeeCreditAmount: 2000,
    pricingApprovalId: reservationId,
    pricingApprovedBy: "admin-1",
    pricingApprovedAt: new Date("2025-12-20"),
    advanceCoverageStart: new Date("2026-01-01T00:00:00.000Z"),
    advanceCoverageEnd: new Date("2026-02-01T00:00:00.000Z"),
  };
};

describe("Contract generation-data tenant isolation", () => {
  let contractA;
  let contractB;

  beforeEach(() => {
    for (const table of [usersById, reservationsById, roomsById, staysById]) {
      for (const key of Object.keys(table)) delete table[key];
    }

    contractA = buildTenantFixture({
      suffix: "a",
      roomType: "private",
      address: { unitHouseNo: "1", street: "Address A Street", city: "Makati" },
      rate: { regular: 16000, discountPercentage: 10, discountAmount: 1600, approved: 14400, advance: 14400, deposit: 14400 },
    });
    contractB = buildTenantFixture({
      suffix: "b",
      roomType: "double-sharing",
      address: { unitHouseNo: "9", street: "Address B Street", city: "Taguig" },
      rate: { regular: 9000, discountPercentage: 5, discountAmount: 450, approved: 8550, advance: 8550, deposit: 8550 },
    });
  });

  const assertIsolatedPayload = (data, expected) => {
    expect(data.tenant.tenantLegalName).toBe(expected.name);
    expect(data.tenant.tenantAddress).toBe(expected.address);
    expect(data.assignment.roomId).toBe(expected.roomId);
    expect(data.assignment.roomType).toBe(expected.roomType);
    expect(new Date(data.lease.leaseStartDate).toISOString()).toBe(expected.leaseStartDate);
    expect(new Date(data.lease.leaseEndDate).toISOString()).toBe(expected.leaseEndDate);
    expect(data.pricing.regularMonthlyRate).toBe(expected.regular);
    expect(data.pricing.discountPercentage).toBe(expected.discountPercentage);
    expect(data.pricing.discountAmount).toBe(expected.discountAmount);
    expect(data.pricing.approvedMonthlyRate).toBe(expected.approved);
    expect(data.pricing.advanceRentAmount).toBe(expected.advance);
    expect(data.pricing.securityDepositAmount).toBe(expected.deposit);
  };

  const expectedA = {
    name: "Tenant A",
    address: "1, Address A Street, Makati",
    roomId: "room-a",
    roomType: "private",
    leaseStartDate: "2026-01-01T00:00:00.000Z",
    leaseEndDate: "2026-02-01T00:00:00.000Z",
    regular: 16000,
    discountPercentage: 10,
    discountAmount: 1600,
    approved: 14400,
    advance: 14400,
    deposit: 14400,
  };
  const expectedB = {
    name: "Tenant B",
    address: "9, Address B Street, Taguig",
    roomId: "room-b",
    roomType: "double-sharing",
    leaseStartDate: "2026-03-01T00:00:00.000Z",
    leaseEndDate: "2026-04-01T00:00:00.000Z",
    regular: 9000,
    discountPercentage: 5,
    discountAmount: 450,
    approved: 8550,
    advance: 8550,
    deposit: 8550,
  };

  test("Contract A and Contract B each resolve only their own tenant's data, generated A then B", async () => {
    const dataA = await buildContractGenerationData(contractA, { verifyTemplate: false });
    const dataB = await buildContractGenerationData(contractB, { verifyTemplate: false });

    assertIsolatedPayload(dataA, expectedA);
    assertIsolatedPayload(dataB, expectedB);

    // Explicit negative assertions: neither payload's rendered field set may
    // contain anything from the other tenant.
    expect(dataA.tenant.tenantLegalName).not.toBe(expectedB.name);
    expect(dataA.tenant.tenantAddress).not.toContain("Address B");
    expect(dataA.fields.tenantResidentialAddress).not.toContain("Address B");
    expect(dataB.tenant.tenantLegalName).not.toBe(expectedA.name);
    expect(dataB.tenant.tenantAddress).not.toContain("Address A");
    expect(dataB.fields.tenantResidentialAddress).not.toContain("Address A");
  });

  test("reversing generation order (B then A) still isolates each tenant's data", async () => {
    const dataB = await buildContractGenerationData(contractB, { verifyTemplate: false });
    const dataA = await buildContractGenerationData(contractA, { verifyTemplate: false });

    assertIsolatedPayload(dataB, expectedB);
    assertIsolatedPayload(dataA, expectedA);

    expect(dataB.tenant.tenantAddress).not.toContain("Address A");
    expect(dataA.tenant.tenantAddress).not.toContain("Address B");
  });
});
