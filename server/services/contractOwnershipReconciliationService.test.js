import { describe, expect, jest, test } from "@jest/globals";
import { ObjectId } from "mongodb";
import {
  applyContractOwnershipReconciliation,
  buildContractOwnershipReconciliationPlan,
} from "./contractOwnershipReconciliationService.js";

const id = () => new ObjectId();
const contract = ({ tenantId, reservationId, tenantEmail, status = "generated", ...overrides }) => ({
  _id: id(),
  tenantId,
  reservationId,
  applicationId: reservationId,
  tenantEmail,
  status,
  isCurrent: true,
  isCanonical: true,
  tenantVisible: true,
  publicationStatus: status === "draft" ? undefined : "ready_for_resident",
  ...overrides,
});

describe("contract ownership reconciliation planning", () => {
  test("rebinds an orphaned Reservation/Contract chain to one exact canonical mobile user", () => {
    const oldTenantId = id();
    const newTenantId = id();
    const reservationId = id();
    const result = buildContractOwnershipReconciliationPlan({
      users: [{ _id: newTenantId, email: "tenant@example.test", role: "tenant" }],
      reservations: [{ _id: reservationId, userId: oldTenantId, status: "moveIn" }],
      stays: [{ _id: id(), tenantId: oldTenantId, reservationId, status: "active" }],
      contracts: [contract({
        tenantId: oldTenantId,
        reservationId,
        tenantEmail: "Tenant@Example.Test",
      })],
    });

    expect(result.blocked).toEqual([]);
    expect(result.actions).toEqual([expect.objectContaining({
      sourceTenantId: oldTenantId,
      targetTenantId: newTenantId,
      contractCount: 1,
      reservationCount: 1,
      stayCount: 1,
    })]);
  });

  test("never rebinds when the immutable identity snapshot is missing or ambiguous", () => {
    const oldTenantId = id();
    const reservationId = id();
    const result = buildContractOwnershipReconciliationPlan({
      users: [],
      reservations: [{ _id: reservationId, userId: oldTenantId }],
      contracts: [contract({ tenantId: oldTenantId, reservationId, tenantEmail: "" })],
    });
    expect(result.actions).toEqual([]);
    expect(result.blocked[0].code).toBe("IDENTITY_SNAPSHOT_NOT_UNIQUE");
  });

  test("ignores archived synthetic test Contracts with no canonical identity", () => {
    const result = buildContractOwnershipReconciliationPlan({
      users: [],
      reservations: [],
      contracts: [contract({
        tenantId: id(),
        reservationId: id(),
        tenantEmail: "",
        status: "archived",
        archivedAt: new Date(),
        isTestRecord: true,
      })],
    });
    expect(result.scannedOrphanOwnerGroups).toBe(0);
    expect(result.actions).toEqual([]);
    expect(result.blocked).toEqual([]);
  });

  test("never rebinds through a non-mobile user or mismatched Reservation owner", () => {
    const oldTenantId = id();
    const otherOldTenantId = id();
    const newTenantId = id();
    const reservationId = id();
    const adminTarget = buildContractOwnershipReconciliationPlan({
      users: [{ _id: newTenantId, email: "tenant@example.test", role: "branch_admin" }],
      reservations: [{ _id: reservationId, userId: oldTenantId }],
      contracts: [contract({ tenantId: oldTenantId, reservationId, tenantEmail: "tenant@example.test" })],
    });
    expect(adminTarget.actions).toEqual([]);
    expect(adminTarget.blocked[0].code).toBe("CANONICAL_USER_NOT_MOBILE_ELIGIBLE");

    const mismatchedReservation = buildContractOwnershipReconciliationPlan({
      users: [{ _id: newTenantId, email: "tenant@example.test", role: "tenant" }],
      reservations: [{ _id: reservationId, userId: otherOldTenantId }],
      contracts: [contract({ tenantId: oldTenantId, reservationId, tenantEmail: "tenant@example.test" })],
    });
    expect(mismatchedReservation.actions).toEqual([]);
    expect(mismatchedReservation.blocked[0].code).toBe("RESERVATION_OWNER_MISMATCH");
  });

  test("blocks a rebind that would create two equally canonical Contracts", () => {
    const oldTenantId = id();
    const newTenantId = id();
    const oldReservationId = id();
    const newReservationId = id();
    const result = buildContractOwnershipReconciliationPlan({
      users: [{ _id: newTenantId, email: "tenant@example.test", role: "tenant" }],
      reservations: [
        { _id: oldReservationId, userId: oldTenantId },
        { _id: newReservationId, userId: newTenantId },
      ],
      contracts: [
        contract({ tenantId: oldTenantId, reservationId: oldReservationId, tenantEmail: "tenant@example.test" }),
        contract({ tenantId: newTenantId, reservationId: newReservationId, tenantEmail: "tenant@example.test" }),
      ],
    });
    expect(result.actions).toEqual([]);
    expect(result.blocked[0].code).toBe("POST_REBIND_MULTIPLE_CANONICAL_CONTRACTS");
  });

  test("a progressed current Contract deterministically outranks a migrated early draft", () => {
    const oldTenantId = id();
    const newTenantId = id();
    const oldReservationId = id();
    const currentReservationId = id();
    const currentStayId = id();
    const result = buildContractOwnershipReconciliationPlan({
      users: [{ _id: newTenantId, email: "tenant@example.test", role: "tenant" }],
      reservations: [
        { _id: oldReservationId, userId: oldTenantId },
        { _id: currentReservationId, userId: newTenantId },
      ],
      stays: [{
        _id: currentStayId,
        tenantId: newTenantId,
        reservationId: currentReservationId,
        status: "active",
        leaseStartDate: new Date("2026-01-01"),
      }],
      contracts: [
        contract({
          tenantId: oldTenantId,
          reservationId: oldReservationId,
          tenantEmail: "tenant@example.test",
          status: "draft",
          publicationStatus: undefined,
        }),
        contract({
          tenantId: newTenantId,
          reservationId: currentReservationId,
          tenantEmail: "tenant@example.test",
          status: "published",
          publicationStatus: "published",
          stayId: currentStayId,
        }),
      ],
    });
    expect(result.blocked).toEqual([]);
    expect(result.actions).toHaveLength(1);
  });

  test("retires terminal Reservation drafts before validating a recreated owner's canonical Contract", () => {
    const oldTenantId = id();
    const newTenantId = id();
    const cancelledReservationId = id();
    const activeReservationId = id();
    const result = buildContractOwnershipReconciliationPlan({
      users: [{ _id: newTenantId, email: "tenant@example.test", role: "tenant" }],
      reservations: [
        {
          _id: cancelledReservationId,
          userId: oldTenantId,
          status: "cancelled",
          isArchived: true,
        },
        {
          _id: activeReservationId,
          userId: newTenantId,
          status: "moveIn",
          isArchived: false,
        },
      ],
      contracts: [
        contract({
          tenantId: oldTenantId,
          reservationId: cancelledReservationId,
          tenantEmail: "tenant@example.test",
          status: "draft",
          publicationStatus: undefined,
        }),
        contract({
          tenantId: newTenantId,
          reservationId: activeReservationId,
          tenantEmail: "tenant@example.test",
          status: "incomplete",
          publicationStatus: undefined,
        }),
      ],
    });

    expect(result.blocked).toEqual([]);
    expect(result.actions).toHaveLength(1);
    expect(result.retirements).toEqual([
      expect.objectContaining({
        reservationId: cancelledReservationId,
        previousStatus: "draft",
      }),
    ]);
  });

  test("allows a no-current-contract result when every early Contract belongs to a terminal Reservation", () => {
    const oldTenantId = id();
    const newTenantId = id();
    const oldReservationId = id();
    const currentReservationId = id();
    const result = buildContractOwnershipReconciliationPlan({
      users: [{ _id: newTenantId, email: "tenant@example.test", role: "applicant" }],
      reservations: [
        { _id: oldReservationId, userId: oldTenantId, status: "archived", isArchived: true },
        { _id: currentReservationId, userId: newTenantId, status: "cancelled" },
      ],
      contracts: [
        contract({
          tenantId: oldTenantId,
          reservationId: oldReservationId,
          tenantEmail: "tenant@example.test",
          status: "draft",
          publicationStatus: undefined,
        }),
        contract({
          tenantId: newTenantId,
          reservationId: currentReservationId,
          tenantEmail: "tenant@example.test",
          status: "incomplete",
          publicationStatus: undefined,
        }),
      ],
    });

    expect(result.blocked).toEqual([]);
    expect(result.actions).toHaveLength(1);
    expect(result.retirements).toHaveLength(2);
  });

  test("applies retirement and identity rebind in one transaction with source-count guards", async () => {
    const sourceTenantId = id();
    const targetTenantId = id();
    const contractId = id();
    const reservationId = id();
    const contractCollection = {
      updateOne: jest.fn(async () => ({ matchedCount: 1, modifiedCount: 1 })),
      updateMany: jest.fn(async () => ({ matchedCount: 1, modifiedCount: 1 })),
    };
    const reservationCollection = {
      updateMany: jest.fn(async () => ({ matchedCount: 2, modifiedCount: 2 })),
    };
    const stayCollection = {
      updateMany: jest.fn(async () => ({ matchedCount: 0, modifiedCount: 0 })),
    };
    const session = {
      withTransaction: jest.fn(async (operation) => operation()),
      endSession: jest.fn(async () => {}),
    };
    const client = { startSession: jest.fn(() => session) };
    const db = {
      collection: jest.fn((name) => ({
        contracts: contractCollection,
        reservations: reservationCollection,
        stays: stayCollection,
      })[name]),
    };

    const result = await applyContractOwnershipReconciliation({
      db,
      client,
      plan: {
        retirements: [{
          contractId,
          reservationId,
          previousStatus: "draft",
        }],
        actions: [{
          sourceTenantId,
          targetTenantId,
          contractCount: 1,
          reservationCount: 2,
          stayCount: 0,
        }],
      },
    });

    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
    expect(contractCollection.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: contractId,
        reservationId,
        status: "draft",
        archivedAt: null,
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "cancelled",
          isCurrent: false,
          isCanonical: false,
          publicationStatus: "withdrawn",
        }),
      }),
      { session },
    );
    expect(contractCollection.updateMany).toHaveBeenCalledWith(
      { tenantId: sourceTenantId },
      { $set: { tenantId: targetTenantId } },
      { session },
    );
    expect(result).toEqual({
      actionsApplied: 1,
      contractsUpdated: 1,
      reservationsUpdated: 2,
      staysUpdated: 0,
      abandonedDraftsRetired: 1,
    });
  });

  test("refuses every write when any identity group remains blocked", async () => {
    const startSession = jest.fn();
    await expect(applyContractOwnershipReconciliation({
      db: {},
      client: { startSession },
      plan: {
        actions: [{ sourceTenantId: id(), targetTenantId: id() }],
        retirements: [],
        blocked: [{ code: "CANONICAL_USER_NOT_UNIQUE" }],
      },
    })).rejects.toMatchObject({ code: "RECONCILIATION_BLOCKED", blockedCount: 1 });
    expect(startSession).not.toHaveBeenCalled();
  });
});
