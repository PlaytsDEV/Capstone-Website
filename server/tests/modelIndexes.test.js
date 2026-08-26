import { describe, it, expect } from "@jest/globals";
import { Bill, TenantViolation } from "../models/index.js";

describe("Model Compound Indexes", () => {
  it("defines compound indexes on Bill for violation lookups", () => {
    const indexes = Bill.schema.indexes();
    const hasViolationIndex = indexes.some(
      ([fields]) => fields.violationId === 1 && fields.isArchived === 1 && fields.status === 1,
    );
    expect(hasViolationIndex).toBe(true);
  });

  it("defines compound indexes on TenantViolation for branch and tenant queries", () => {
    const indexes = TenantViolation.schema.indexes();
    const hasBranchIndex = indexes.some(
      ([fields]) => fields.branch === 1 && fields.isArchived === 1 && fields.createdAt === -1,
    );
    const hasTenantIndex = indexes.some(
      ([fields]) => fields.tenantId === 1 && fields.isArchived === 1,
    );
    expect(hasBranchIndex).toBe(true);
    expect(hasTenantIndex).toBe(true);
  });
});
