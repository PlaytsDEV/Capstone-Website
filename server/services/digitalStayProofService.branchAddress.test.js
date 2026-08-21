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

const { resolveDigitalStayProofData, mapStayDataToContractPayload } = await import("./digitalStayProofService.js");

const CONTRACT_ID = "6b0000000000000000000001";
const RESERVATION_ID = "6b0000000000000000000002";
const TENANT_ID = "6b0000000000000000000003";
const ROOM_ID = "6b0000000000000000000004";

const baseContract = (branch) => ({
  _id: CONTRACT_ID,
  tenantId: TENANT_ID,
  reservationId: RESERVATION_ID,
  roomId: ROOM_ID,
  contractNumber: "LIL-TEST-2026-00001",
  tenantLegalName: "Test Tenant",
  tenantAddress: "Somewhere, Metro Manila",
  branch,
  status: "ready_for_generation",
});

// Reproduces the production defect: digitalStayProofService.js used to
// resolve branchAddress by string-matching a title-cased display name,
// which only recognized "guadalupe" (and a "poblacion" branch that has
// never existed in ROOM_BRANCHES) and silently fell every other real
// branch through to a fabricated generic "Lilycrest Dormitory Residence,
// Metro Manila" address — confirmed live for a Gil Puyat tenant
// (Leander Ponce, LIL-GP-2026-00022).
describe("resolveDigitalStayProofData branch/property address resolution", () => {
  beforeEach(() => {
    records.contract = null;
    records.reservation = null;
    records.room = null;
    records.user = null;
    records.stay = null;
  });

  test("Gil Puyat resolves its real canonical property address, not the generic fallback", async () => {
    records.contract = baseContract("gil-puyat");
    records.room = { _id: ROOM_ID, branch: "gil-puyat", type: "private", roomNumber: "GP-704" };

    const data = await resolveDigitalStayProofData({ contractId: CONTRACT_ID });

    expect(data.branchAddress).toBe("#7 Gil Puyat Ave. corner Marconi St., Makati City");
    expect(data.propertyAddress).toBe(data.branchAddress);
    expect(data.propertyName).toBe("LILYCREST GIL PUYAT");
    expect(data.branchAddress).not.toContain("Lilycrest Dormitory Residence");
    expect(data.branchAddress).not.toContain("Metro Manila");
  });

  test("Guadalupe still resolves its real canonical property address (regression safety)", async () => {
    records.contract = baseContract("guadalupe");
    records.room = { _id: ROOM_ID, branch: "guadalupe", type: "quadruple-sharing", roomNumber: "GUAD-305" };

    const data = await resolveDigitalStayProofData({ contractId: CONTRACT_ID });

    expect(data.branchAddress).toBe("9431 Magallanes Street, 1212 Makati, Metro Manila");
    expect(data.propertyAddress).toBe(data.branchAddress);
    expect(data.propertyName).toBe("LILYCREST GUADALUPE");
  });

  test("Gil Puyat and Guadalupe resolve to different addresses (no shared generic fallback)", async () => {
    records.contract = baseContract("gil-puyat");
    records.room = { _id: ROOM_ID, branch: "gil-puyat", type: "private", roomNumber: "GP-704" };
    const gilPuyat = await resolveDigitalStayProofData({ contractId: CONTRACT_ID });

    records.contract = baseContract("guadalupe");
    records.room = { _id: ROOM_ID, branch: "guadalupe", type: "quadruple-sharing", roomNumber: "GUAD-305" };
    const guadalupe = await resolveDigitalStayProofData({ contractId: CONTRACT_ID });

    expect(gilPuyat.branchAddress).not.toBe(guadalupe.branchAddress);
    expect(gilPuyat.propertyName).not.toBe(guadalupe.propertyName);
  });

  test("an unrecognized/legacy branch value uses a neutral placeholder, never a fabricated known-branch address", async () => {
    records.contract = baseContract("some-legacy-branch");
    records.room = { _id: ROOM_ID, branch: "some-legacy-branch", type: "private", roomNumber: "X-1" };

    const data = await resolveDigitalStayProofData({ contractId: CONTRACT_ID });

    expect(data.branchAddress).toBe("Address not available");
    expect(data.branchAddress).not.toContain("Lilycrest Dormitory Residence");
  });

  test("the stay-proof PDF payload receives the same canonical propertyAddress/propertyName as the preview", async () => {
    records.contract = baseContract("gil-puyat");
    records.room = { _id: ROOM_ID, branch: "gil-puyat", type: "private", roomNumber: "GP-704" };

    const data = await resolveDigitalStayProofData({ contractId: CONTRACT_ID });
    const payload = mapStayDataToContractPayload(data);

    expect(payload.property.propertyAddress).toBe(data.propertyAddress);
    expect(payload.property.propertyName).toBe(data.propertyName);
    expect(payload.property.propertyAddress).toBe("#7 Gil Puyat Ave. corner Marconi St., Makati City");
  });
});
