import { describe, expect, test } from "@jest/globals";
import { archiveContractForCancelledReservation } from "./contractArchiveService.js";

/**
 * Minimal in-memory fake standing in for the Mongoose Contract model, driven
 * through the same `adapters.ContractModel` seam archiveContract() already
 * uses — no real MongoDB connection required.
 */
const makeFakeContractModel = (seedDocs) => {
  const store = new Map(seedDocs.map((doc) => [doc._id, { ...doc }]));
  return {
    find: async (query) => Object.values(Object.fromEntries(store))
      .filter((doc) => String(doc.reservationId) === String(query.reservationId) && doc.archivedAt === null),
    findOneAndUpdate: async (filter, update) => {
      const current = store.get(filter._id);
      if (!current || current.archivedAt !== null) return null;
      const next = { ...current, ...update.$set };
      if (update.$push?.statusHistory) {
        next.statusHistory = [...(current.statusHistory || []), update.$push.statusHistory];
      }
      store.set(filter._id, next);
      return next;
    },
    _store: store,
  };
};

const draftContract = (overrides = {}) => ({
  _id: "contract-1",
  reservationId: "reservation-1",
  status: "draft",
  archivedAt: null,
  isCurrent: true,
  isCanonical: true,
  statusHistory: [],
  ...overrides,
});

describe("archiveContractForCancelledReservation", () => {
  test("archives a draft Contract tied to the cancelled Reservation", async () => {
    const ContractModel = makeFakeContractModel([draftContract()]);
    const [archived] = await archiveContractForCancelledReservation({
      reservationId: "reservation-1",
      actorId: "admin-1",
      adapters: { ContractModel },
    });
    expect(archived.status).toBe("cancelled");
    expect(archived.archivedAt).toBeInstanceOf(Date);
    expect(archived.isCurrent).toBe(false);
    expect(archived.isCanonical).toBe(false);
    expect(archived.tenantVisible).toBe(false);
    expect(archived.archivedBy).toBe("admin-1");
    expect(archived.archiveReason).toMatch(/early-stage draft lifecycle/);
    expect(archived.statusHistory).toHaveLength(1);
  });

  test.each(["incomplete", "ready_for_generation"])(
    "also archives a %s-status Contract",
    async (status) => {
      const ContractModel = makeFakeContractModel([draftContract({ status })]);
      const result = await archiveContractForCancelledReservation({
        reservationId: "reservation-1",
        actorId: "admin-1",
        adapters: { ContractModel },
      });
      expect(result).toHaveLength(1);
    },
  );

  test.each(["generated", "published", "active", "signed"])(
    "does not touch a %s Contract that has progressed past draft",
    async (status) => {
      const ContractModel = makeFakeContractModel([draftContract({ status })]);
      const result = await archiveContractForCancelledReservation({
        reservationId: "reservation-1",
        actorId: "admin-1",
        adapters: { ContractModel },
      });
      expect(result).toHaveLength(0);
      expect(ContractModel._store.get("contract-1").archivedAt).toBeNull();
    },
  );

  test("is a no-op when no Contract is linked to the Reservation", async () => {
    const ContractModel = makeFakeContractModel([]);
    const result = await archiveContractForCancelledReservation({
      reservationId: "reservation-1",
      actorId: "admin-1",
      adapters: { ContractModel },
    });
    expect(result).toEqual([]);
  });

  test("is a no-op when reservationId is missing", async () => {
    const result = await archiveContractForCancelledReservation({ actorId: "admin-1" });
    expect(result).toBeNull();
  });

  test("skips a Contract already archived", async () => {
    const ContractModel = makeFakeContractModel([draftContract({ archivedAt: new Date("2026-01-01") })]);
    const result = await archiveContractForCancelledReservation({
      reservationId: "reservation-1",
      actorId: "admin-1",
      adapters: { ContractModel },
    });
    expect(result).toEqual([]);
  });
});
