import { describe, expect, test } from "@jest/globals";
import mongoose from "mongoose";
import Contract, { CONTRACT_STATUSES } from "../models/Contract.js";
import ContractCounter from "../models/ContractCounter.js";
import {
  CONTRACT_LESSOR,
  isRoomTypeAllowedForBranch,
  normalizeContractRoomType,
  resolveAllowedContractRoomTypes,
  resolveContractBranch,
  validateBranchRoomType,
} from "../config/contractConfig.js";
import {
  assertValidContractTransition,
  CONTRACT_TRANSITIONS,
  formatContractNumber,
  getContractValidation,
} from "./contractService.js";
import { assertContractBranchAccess } from "../controllers/contractController.js";

const oid = () => new mongoose.Types.ObjectId();

const validContractData = () => ({
  tenantId: oid(),
  reservationId: oid(),
  stayId: oid(),
  roomId: oid(),
  branch: "gil-puyat",
  contractNumber: "TEST-CONTRACT-0001",
  contractYear: 2026,
  contractSequence: 1,
  roomType: "private",
  leaseType: "short_term",
  propertyName: "LILYCREST GIL PUYAT",
  propertyAddress: "#7 Gil Puyat Ave. corner Marconi St., Makati City",
  roomNumber: "101",
  bedId: "101-A",
  bedLabel: "101-A",
  tenantLegalName: "Test Tenant",
  tenantAddress: "Makati City",
  leaseStartDate: new Date("2026-01-01"),
  leaseEndDate: new Date("2026-02-01"),
  leaseDurationMonths: 1,
  approvedMonthlyRate: 5000,
  createdBy: oid(),
  updatedBy: oid(),
});

describe("Contract Management foundation", () => {
  test("Contract model creates a valid draft and records all controlled statuses", () => {
    const contract = new Contract(validContractData());
    const error = contract.validateSync();
    expect(error).toBeUndefined();
    expect(contract.status).toBe("draft");
    expect(Contract.schema.path("status").enumValues).toEqual(CONTRACT_STATUSES);
  });

  test("contract number and branch/year/sequence indexes are unique", () => {
    const indexes = Contract.schema.indexes();
    expect(Contract.schema.path("contractNumber").options.unique).toBe(true);
    expect(indexes).toEqual(expect.arrayContaining([
      [{ branch: 1, contractYear: 1, contractSequence: 1 }, expect.objectContaining({ unique: true })],
    ]));
    expect(ContractCounter.schema.indexes()).toEqual(expect.arrayContaining([
      [{ branch: 1, year: 1 }, expect.objectContaining({ unique: true })],
    ]));
  });

  test.each([
    ["gil-puyat", "LILYCREST GIL PUYAT", "#7 Gil Puyat Ave. corner Marconi St., Makati City"],
    ["guadalupe", "LILYCREST GUADALUPE", "9431 Magallanes Street, 1212 Makati, Metro Manila"],
  ])("resolves verified %s property data", (branch, name, address) => {
    expect(resolveContractBranch(branch)).toEqual(expect.objectContaining({
      propertyName: name,
      propertyAddress: address,
      lessor: CONTRACT_LESSOR,
    }));
  });

  test("branch configuration exposes canonical allowed room types", () => {
    expect(resolveAllowedContractRoomTypes("gil-puyat")).toEqual([
      "private", "double-sharing", "quadruple-sharing",
    ]);
    expect(resolveAllowedContractRoomTypes("guadalupe")).toEqual([
      "quadruple-sharing",
    ]);
  });

  test.each([
    ["guadalupe", "quadruple-sharing"],
    ["gil-puyat", "private"],
    ["gil-puyat", "double-sharing"],
    ["gil-puyat", "quadruple-sharing"],
  ])("accepts %s with actual %s rooms", (branch, roomType) => {
    expect(validateBranchRoomType(branch, roomType)).toBe(roomType);
    expect(isRoomTypeAllowedForBranch(branch, roomType)).toBe(true);
  });

  test.each([
    ["private"],
    ["private_room"],
    ["Private Room"],
    ["double"],
    ["double_sharing"],
    ["Double Sharing"],
  ])("rejects Guadalupe legacy or canonical %s rooms", (roomType) => {
    expect(() => validateBranchRoomType("guadalupe", roomType)).toThrow(
      expect.objectContaining({
        code: "ROOM_TYPE_NOT_ALLOWED_FOR_BRANCH",
        details: expect.objectContaining({
          branch: "guadalupe",
          allowedRoomTypes: ["quadruple-sharing"],
        }),
      }),
    );
  });

  test.each([
    ["quadruple_sharing"],
    ["Quadruple Sharing"],
    ["four_sharing"],
    ["Four Sharing"],
    ["4 Sharing"],
  ])("normalizes and accepts legacy Quadruple label %s", (roomType) => {
    expect(normalizeContractRoomType(roomType)).toBe("quadruple-sharing");
    expect(validateBranchRoomType("guadalupe", roomType)).toBe("quadruple-sharing");
  });

  test("frontend roomType is not consumed by the Contract draft route", async () => {
    const source = await import("node:fs/promises").then(({ readFile }) =>
      readFile(new URL("../controllers/contractController.js", import.meta.url), "utf8"));
    expect(source).not.toMatch(/req\.body\??\.roomType/);
    expect(source).not.toMatch(/req\.body\.roomType/);
  });

  test("a Room branch outside the admin branch is rejected", () => {
    expect(() => assertContractBranchAccess(
      { branchFilter: "gil-puyat" },
      "guadalupe",
    )).toThrow(expect.objectContaining({
      code: "CONTRACT_BRANCH_ACCESS_DENIED",
    }));
  });

  test("formats backend contract numbers by branch and year", () => {
    expect(formatContractNumber("gil-puyat", 2099, 1)).toBe("LIL-GP-2099-00001");
    expect(formatContractNumber("guadalupe", 2026, 42)).toBe("LIL-GUAD-2026-00042");
  });

  test("only one current Contract can reference a Stay", () => {
    expect(Contract.schema.indexes()).toEqual(expect.arrayContaining([
      [{ stayId: 1 }, expect.objectContaining({
        unique: true,
        partialFilterExpression: { stayId: { $type: "objectId" }, isCurrent: true },
      })],
    ]));
  });

  test.each([
    ["draft", "incomplete"],
    ["draft", "ready_for_generation"],
    ["generated", "awaiting_signatures"],
    ["generated", "notarized"],
    ["signed", "notarized"],
    ["published", "active"],
  ])("allows valid transition %s -> %s", (from, to) => {
    expect(assertValidContractTransition(from, to)).toBe(true);
  });

  test.each([
    ["draft", "active"],
    ["generated", "active"],
    ["signed", "active"],
    ["notarized", "published"],
  ])("rejects invalid transition %s -> %s", (from, to) => {
    expect(() => assertValidContractTransition(from, to)).toThrow(
      expect.objectContaining({ code: "INVALID_CONTRACT_STATUS_TRANSITION" }),
    );
  });

  test("moveIn is not a Contract status or transition trigger", () => {
    expect(CONTRACT_STATUSES).not.toContain("moveIn");
    expect(Object.values(CONTRACT_TRANSITIONS).flat()).not.toContain("moveIn");
  });

  test("branch admin is denied another branch while owner scope permits both", () => {
    expect(() => assertContractBranchAccess({ branchFilter: "gil-puyat" }, "guadalupe"))
      .toThrow(expect.objectContaining({ code: "CONTRACT_BRANCH_ACCESS_DENIED" }));
    expect(() => assertContractBranchAccess({ branchFilter: null, isOwner: true }, "gil-puyat")).not.toThrow();
    expect(() => assertContractBranchAccess({ branchFilter: null, isOwner: true }, "guadalupe")).not.toThrow();
  });

  test("admin routes are protected by admin middleware and tenant permission checks", async () => {
    const router = (await import("../routes/contractRoutes.js")).default;
    const middlewareNames = router.stack
      .filter((layer) => !layer.route)
      .map((layer) => layer.handle.name);
    expect(middlewareNames).toEqual(expect.arrayContaining(["verifyToken", "verifyAdmin", "filterByBranch"]));
    expect(router.stack.filter((layer) => !layer.route)).toHaveLength(4);
  });

  test("tenant identity snapshot paths are immutable while pricing is service-locked after generation", () => {
    for (const path of [
      "tenantLegalName", "tenantAddress", "tenantEmail", "tenantPhone",
      "tenantNationality", "propertyName", "propertyAddress", "roomNumber",
      "leaseStartDate", "leaseEndDate", "leaseDurationMonths",
    ]) {
      expect(Contract.schema.path(path).options.immutable).toBe(true);
    }
    for (const path of [
      "regularMonthlyRate", "discountPercentage", "discountAmount",
      "approvedMonthlyRate", "advanceRentAmount", "securityDepositAmount",
    ]) {
      expect(Contract.schema.path(path)).toBeDefined();
    }
  });

  test("validation reports missing legal and approved pricing data", () => {
    const contract = new Contract({ ...validContractData(), tenantAddress: "", approvedMonthlyRate: null });
    const result = getContractValidation(contract);
    expect(result.valid).toBe(false);
    expect(result.missingFields.map(({ field }) => field)).toEqual(
      expect.arrayContaining(["tenantAddress", "approvedMonthlyRate"]),
    );
  });
});
