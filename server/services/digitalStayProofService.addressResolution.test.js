import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const records = { contract: null, reservation: null, room: null, user: null, stay: null };

const query = (key) => {
  const q = {};
  q.populate = jest.fn().mockReturnValue(q);
  q.sort = jest.fn().mockReturnValue(q);
  q.lean = jest.fn().mockImplementation(async () => records[key]);
  return q;
};

await jest.unstable_mockModule("../models/index.js", () => ({
  Contract: {
    findById: jest.fn(() => query("contract")),
    findOne: jest.fn(() => query("contract")),
    find: jest.fn(() => ({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) })),
  },
  Reservation: {
    findById: jest.fn(() => query("reservation")),
    findOne: jest.fn(() => query("reservation")),
  },
  Room: { findById: jest.fn(() => query("room")) },
  Stay: { findById: jest.fn(() => query("stay")) },
  User: { findById: jest.fn(() => query("user")) },
}));

const { resolveDigitalStayProofData } = await import("./digitalStayProofService.js");

// Realistic 24-hex ids — resolveDigitalStayProofData gates several lookups
// behind mongoose.isValidObjectId(), so plain test slugs like "tenant-1"
// silently skip those branches instead of exercising them.
const CONTRACT_ID = "6a0000000000000000000001";
const RESERVATION_ID_1 = "6a0000000000000000000002";
const TENANT_ID_1 = "6a0000000000000000000003";
const ROOM_ID = "6a0000000000000000000004";

const TENANT_ID_2 = "6a0000000000000000000005";
const RESERVATION_ID_2 = "6a0000000000000000000006";

const TENANT_ID_3 = "6a0000000000000000000007";
const RESERVATION_ID_3 = "6a0000000000000000000008";

describe("resolveDigitalStayProofData tenant address resolution", () => {
  beforeEach(() => {
    records.contract = null;
    records.reservation = null;
    records.room = null;
    records.user = null;
    records.stay = null;
  });

  test("prefers the Contract's own authoritative tenantAddress snapshot, never a hardcoded placeholder", async () => {
    records.contract = {
      _id: CONTRACT_ID,
      tenantId: TENANT_ID_1,
      reservationId: RESERVATION_ID_1,
      roomId: ROOM_ID,
      contractNumber: "LIL-GP-2026-00010",
      tenantLegalName: "Ayla Suson",
      tenantAddress: "2811, Mendoza, Barangay 182, City of Manila, National Capital Region (NCR)",
      branch: "gil-puyat",
      status: "ready_for_generation",
    };
    records.reservation = {
      _id: RESERVATION_ID_1,
      userId: TENANT_ID_1,
      firstName: "Ayla",
      lastName: "Suson",
      address: { unitHouseNo: "999", street: "Different Street", city: "Quezon City" },
    };
    records.user = { _id: TENANT_ID_1, firstName: "Ayla", lastName: "Suson", address: "999 Some Other Street" };
    records.room = { _id: ROOM_ID, branch: "gil-puyat", type: "private", roomNumber: "GP-810" };

    const data = await resolveDigitalStayProofData({ contractId: CONTRACT_ID });

    expect(data.tenantAddress).toBe(
      "2811, Mendoza, Barangay 182, City of Manila, National Capital Region (NCR)",
    );
    expect(data.tenantResidentialAddress).toBe(data.tenantAddress);
    expect(data.tenantAddress).not.toBe("Makati City, Metro Manila");
    expect(data.tenantAddress).not.toContain("SMDC JAZZ RESIDENCES");
  });

  test("falls back to the Reservation's formatted address when no Contract exists yet", async () => {
    records.user = { _id: TENANT_ID_2, firstName: "Bea", lastName: "Reyes", address: "" };
    records.reservation = {
      _id: RESERVATION_ID_2,
      userId: TENANT_ID_2,
      firstName: "Bea",
      lastName: "Reyes",
      status: "reserved",
      address: { unitHouseNo: "12", street: "Kalayaan Ave", barangay: "Poblacion", city: "Makati City" },
    };

    const data = await resolveDigitalStayProofData({ tenantId: TENANT_ID_2 });

    expect(data.tenantAddress).toBe("12, Kalayaan Ave, Poblacion, Makati City");
    expect(data.tenantResidentialAddress).toBe(data.tenantAddress);
  });

  test("falls back to the live User.address string when neither Contract nor Reservation has one", async () => {
    records.user = { _id: TENANT_ID_3, firstName: "Cy", lastName: "Santos", address: "Unit 5B, Legit Real Address, Pasig" };
    records.reservation = {
      _id: RESERVATION_ID_3,
      userId: TENANT_ID_3,
      firstName: "Cy",
      lastName: "Santos",
      status: "reserved",
      address: {},
    };

    const data = await resolveDigitalStayProofData({ tenantId: TENANT_ID_3 });

    expect(data.tenantAddress).toBe("Unit 5B, Legit Real Address, Pasig");
    expect(data.tenantResidentialAddress).toBe(data.tenantAddress);
  });
});
