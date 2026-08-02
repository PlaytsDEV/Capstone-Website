import { describe, expect, jest, test } from "@jest/globals";

const auditLog = jest.fn().mockResolvedValue(undefined);
await jest.unstable_mockModule("../utils/auditLogger.js", () => ({
  default: { log: auditLog },
}));

const { enforceAuthoritativeBranch, roomContainsBed } = await import(
  "./branchAuthorizationService.js"
);

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const branchRequest = (branch) => ({
  id: "request-1",
  branchFilter: branch,
  isOwner: false,
  authUser: { role: "branch_admin", branch },
});

describe("authoritative branch enforcement", () => {
  test.each(["gil-puyat", "guadalupe"])("allows a %s Branch Admin on matching records", async (branch) => {
    const res = response();
    const result = await enforceAuthoritativeBranch({
      req: branchRequest(branch), res, action: "test.action",
      sources: [{ source: "room", value: branch }],
    });
    expect(result.branchId).toBe(branch);
    expect(res.body).toBeNull();
  });

  test.each([
    ["gil-puyat", "guadalupe"],
    ["guadalupe", "gil-puyat"],
  ])("denies a %s Branch Admin acting on %s", async (actorBranch, targetBranch) => {
    const res = response();
    const result = await enforceAuthoritativeBranch({
      req: branchRequest(actorBranch), res, action: "test.action",
      sources: [{ source: "room", value: targetBranch }],
    });
    expect(result).toBeNull();
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("BRANCH_ACCESS_DENIED");
  });

  test.each([
    [{ authUser: { role: "branch_admin" }, isOwner: false }, "BRANCH_SCOPE_MISSING"],
    [{ branchFilter: "gil-puyat", authUser: { role: "branch_admin" } }, "BRANCH_SCOPE_MISSING"],
  ])("fails closed when middleware scope is missing", async (req, code) => {
    const res = response();
    await enforceAuthoritativeBranch({ req, res, action: "test.action", sources: [{ source: "room", value: "gil-puyat" }] });
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe(code);
  });

  test("fails closed for missing and conflicting target branches", async () => {
    const missing = response();
    await enforceAuthoritativeBranch({ req: branchRequest("gil-puyat"), res: missing, action: "test.action", sources: [{ source: "room", value: null }] });
    expect(missing.statusCode).toBe(422);
    expect(missing.body.code).toBe("TARGET_BRANCH_UNRESOLVED");

    const conflict = response();
    await enforceAuthoritativeBranch({ req: branchRequest("gil-puyat"), res: conflict, action: "test.action", sources: [{ source: "bill", value: "gil-puyat" }, { source: "room", value: "guadalupe" }] });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.body.code).toBe("BRANCH_RELATIONSHIP_INCONSISTENT");
  });

  const securedActions = [
    "reservation.cancellation.approve",
    "reservation.cancellation.reject",
    "reservation.pre_move_in_modification.approve",
    "reservation.pre_move_in_modification.reject",
    "tenancy.transfer.cancel",
    "tenancy.move_out.cancel",
    "tenancy.early_termination.execute",
    "tenancy.room_swap.execute",
    "tenancy.abandonment.execute",
    "billing.milestone_arrangement.create",
  ];

  test.each(securedActions.flatMap((action) => ["gil-puyat", "guadalupe"].map((branch) => [action, branch])))
  ("preserves owner/Super Admin global access for %s on %s", async (action, branch) => {
    const res = response();
    const result = await enforceAuthoritativeBranch({
      req: { branchFilter: null, isOwner: true, authUser: { role: "owner" } },
      res, action, sources: [{ source: "room", value: branch }],
    });
    expect(result.branchId).toBe(branch);
  });

  test("validates that a bed belongs to its authoritative Room", () => {
    expect(roomContainsBed({ beds: [{ id: "A" }] }, "A")).toBe(true);
    expect(roomContainsBed({ beds: [{ id: "A" }] }, "B")).toBe(false);
  });
});
