import { describe, expect, jest, test } from "@jest/globals";

await jest.unstable_mockModule("../models/index.js", () => ({
  User: { findOne: jest.fn() },
  INQUIRY_BRANCHES: ["gil-puyat", "guadalupe", "general"],
}));

const { filterByBranch } = await import("./branchAccess.js");

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

describe("filterByBranch security contract", () => {
  test.each(["gil-puyat", "guadalupe"])("populates req.branchFilter for %s Branch Admin", async (branch) => {
    const req = { user: { uid: "firebase-admin" }, authUser: { role: "branch_admin", branch } };
    const next = jest.fn();
    await filterByBranch(req, response(), next);
    expect(req.branchFilter).toBe(branch);
    expect(req.isOwner).toBe(false);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("preserves owner/Super Admin global scope", async () => {
    const req = { user: { uid: "firebase-owner" }, authUser: { role: "owner", branch: null } };
    const next = jest.fn();
    await filterByBranch(req, response(), next);
    expect(req.branchFilter).toBeNull();
    expect(req.isOwner).toBe(true);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("fails closed when a Branch Admin has no assigned branch", async () => {
    const req = { user: { uid: "firebase-admin" }, authUser: { role: "branch_admin", branch: null } };
    const res = response();
    const next = jest.fn();
    await filterByBranch(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("NO_BRANCH_ASSIGNED");
    expect(next).not.toHaveBeenCalled();
  });
});
