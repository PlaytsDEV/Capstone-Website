import { describe, expect, it } from "@jest/globals";
import mongoose from "mongoose";
import {
  EXCLUDED_STATUSES,
  isCurrentActiveCandidate,
  computeDocumentScore,
  sortContractCandidates,
  buildReconciliationPlan,
  applyReconciliation,
} from "./reconcile_duplicate_contracts.mjs";

describe("reconcile_duplicate_contracts", () => {
  describe("EXCLUDED_STATUSES & isCurrentActiveCandidate", () => {
    it("excludes all non-active terminal statuses", () => {
      const statuses = ["voided", "cancelled", "archived", "rejected", "replaced", "terminated"];
      for (const status of statuses) {
        expect(EXCLUDED_STATUSES.has(status)).toBe(true);
        expect(isCurrentActiveCandidate({ status, isCurrent: true, isCanonical: true })).toBe(false);
      }
    });

    it("rejects records with isCurrent: false or isCanonical: false", () => {
      expect(isCurrentActiveCandidate({ status: "active", isCurrent: false, isCanonical: true })).toBe(false);
      expect(isCurrentActiveCandidate({ status: "active", isCurrent: true, isCanonical: false })).toBe(false);
    });

    it("rejects records with archivedAt or duplicateOfContractId", () => {
      expect(isCurrentActiveCandidate({ status: "active", archivedAt: new Date() })).toBe(false);
      expect(isCurrentActiveCandidate({ status: "active", duplicateOfContractId: "some-id" })).toBe(false);
    });

    it("accepts valid active contract candidates", () => {
      expect(isCurrentActiveCandidate({ status: "active", isCurrent: true, isCanonical: true })).toBe(true);
      expect(isCurrentActiveCandidate({ status: "generated", isCurrent: true, isCanonical: true })).toBe(true);
      expect(isCurrentActiveCandidate({ status: "signed", isCurrent: true, isCanonical: true })).toBe(true);
      expect(isCurrentActiveCandidate({ status: "notarized", isCurrent: true, isCanonical: true })).toBe(true);
    });
  });

  describe("computeDocumentScore", () => {
    it("returns 0 for empty or invalid contract", () => {
      expect(computeDocumentScore(null)).toBe(0);
      expect(computeDocumentScore({})).toBe(0);
    });

    it("scores notarized documents at +4", () => {
      expect(computeDocumentScore({ notarizedDocuments: [{ version: 1 }] })).toBe(4);
    });

    it("scores signed documents at +2", () => {
      expect(computeDocumentScore({ signedDocuments: [{ version: 1 }] })).toBe(2);
    });

    it("scores prepared documents or generated status at +1", () => {
      expect(computeDocumentScore({ preparedDocuments: [{ version: 1 }] })).toBe(1);
      expect(computeDocumentScore({ status: "generated" })).toBe(1);
    });

    it("accumulates score correctly for full document lifecycle", () => {
      expect(
        computeDocumentScore({
          status: "published",
          preparedDocuments: [{ version: 1 }],
          signedDocuments: [{ version: 1 }],
          notarizedDocuments: [{ version: 1 }],
        }),
      ).toBe(7); // 4 + 2 + 1
    });
  });

  describe("sortContractCandidates", () => {
    it("sorts by document score descending", () => {
      const lower = { _id: "c1", status: "generated", createdAt: "2026-01-01" }; // score 1
      const higher = { _id: "c2", signedDocuments: [{ version: 1 }], createdAt: "2025-01-01" }; // score 2
      const sorted = sortContractCandidates([lower, higher]);
      expect(sorted[0]._id).toBe("c2");
      expect(sorted[1]._id).toBe("c1");
    });

    it("tie-breaks by newest updatedAt/createdAt timestamp when scores match", () => {
      const older = { _id: "c1", status: "signed", signedDocuments: [{ version: 1 }], updatedAt: "2026-01-01" };
      const newer = { _id: "c2", status: "signed", signedDocuments: [{ version: 1 }], updatedAt: "2026-06-01" };
      const sorted = sortContractCandidates([older, newer]);
      expect(sorted[0]._id).toBe("c2");
      expect(sorted[1]._id).toBe("c1");
    });

    it("tie-breaks by version when scores and timestamps match", () => {
      const v1 = { _id: "c1", status: "generated", version: 1, createdAt: "2026-01-01" };
      const v2 = { _id: "c2", status: "generated", version: 2, createdAt: "2026-01-01" };
      const sorted = sortContractCandidates([v1, v2]);
      expect(sorted[0]._id).toBe("c2");
      expect(sorted[1]._id).toBe("c1");
    });
  });

  describe("buildReconciliationPlan", () => {
    it("ignores tenants with only 1 active contract", () => {
      const contracts = [
        { _id: "c1", tenantId: "t1", status: "active", isCurrent: true, isCanonical: true },
        { _id: "c2", tenantId: "t2", status: "active", isCurrent: true, isCanonical: true },
      ];
      const plan = buildReconciliationPlan(contracts);
      expect(plan.conflictingGroupsCount).toBe(0);
      expect(plan.totalDuplicatesToArchive).toBe(0);
    });

    it("detects conflicting groups with multiple active contracts", () => {
      const contracts = [
        {
          _id: "c1_old",
          contractNumber: "GP-2026-001",
          tenantId: "t1",
          status: "generated",
          version: 1,
          createdAt: "2026-01-01",
          isCurrent: true,
          isCanonical: true,
        },
        {
          _id: "c1_notarized",
          contractNumber: "GP-2026-002",
          tenantId: "t1",
          status: "notarized",
          version: 1,
          notarizedDocuments: [{ version: 1 }],
          signedDocuments: [{ version: 1 }],
          preparedDocuments: [{ version: 1 }],
          createdAt: "2026-02-01",
          isCurrent: true,
          isCanonical: true,
        },
      ];
      const users = [{ _id: "t1", firstName: "Juan", lastName: "Dela Cruz", email: "juan@example.com" }];

      const plan = buildReconciliationPlan(contracts, { users });
      expect(plan.conflictingGroupsCount).toBe(1);
      expect(plan.totalDuplicatesToArchive).toBe(1);

      const group = plan.conflictingGroups[0];
      expect(group.tenantId).toBe("t1");
      expect(group.tenantLabel).toBe("Juan Dela Cruz");
      expect(group.canonical._id).toBe("c1_notarized");
      expect(group.canonical.docScore).toBe(7);

      expect(group.duplicates.length).toBe(1);
      expect(group.duplicates[0]._id).toBe("c1_old");
      expect(group.duplicates[0].proposedAction.status).toBe("voided");
      expect(group.duplicates[0].proposedAction.publicationStatus).toBe("withdrawn");
      expect(group.duplicates[0].proposedAction.duplicateOfContractId).toBe("c1_notarized");
    });
  });

  describe("applyReconciliation", () => {
    it("updates duplicate contract records in MongoDB collection", async () => {
      const updatedDocs = [];
      const mockCollection = {
        updateOne: async (query, update) => {
          updatedDocs.push({ query, update });
          return { modifiedCount: 1 };
        },
      };
      const mockDb = {
        collection: (name) => {
          if (name === "contracts") return mockCollection;
          throw new Error(`Unexpected collection: ${name}`);
        },
      };

      const plan = {
        conflictingGroups: [
          {
            tenantId: "507f1f77bcf86cd799439011",
            canonical: {
              _id: "507f1f77bcf86cd799439012",
              contractNumber: "GP-2026-100",
            },
            duplicates: [
              {
                _id: "507f1f77bcf86cd799439013",
                contractNumber: "GP-2026-099",
              },
            ],
          },
        ],
      };

      const result = await applyReconciliation({ db: mockDb, plan });
      expect(result.updatedContractsCount).toBe(1);
      expect(updatedDocs.length).toBe(1);

      const op = updatedDocs[0];
      expect(op.query._id).toEqual(new mongoose.Types.ObjectId("507f1f77bcf86cd799439013"));
      expect(op.update.$set.isCurrent).toBe(false);
      expect(op.update.$set.isCanonical).toBe(false);
      expect(op.update.$set.status).toBe("voided");
      expect(op.update.$set.publicationStatus).toBe("withdrawn");
      expect(op.update.$set.duplicateOfContractId).toEqual(new mongoose.Types.ObjectId("507f1f77bcf86cd799439012"));
      expect(op.update.$set.reconciliationNote).toContain("Archived as duplicate of canonical contract 507f1f77bcf86cd799439012");
      expect(op.update.$push.statusHistory.status).toBe("voided");
    });
  });
});
