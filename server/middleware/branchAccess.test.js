import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const lean = jest.fn();
const select = jest.fn(() => ({ lean }));
const findOne = jest.fn(() => ({ select }));

await jest.unstable_mockModule("../models/index.js", () => ({
  User: { findOne },
  INQUIRY_BRANCHES: ["main", "annex", "general"],
}));

const {
  filterByBranch,
  validateBranchAccess,
  getUserBranchInfo,
} = await import("./branchAccess.js");

const createRes = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

describe("branchAccess middleware", () => {
  beforeEach(() => {
    findOne.mockReset();
    select.mockClear();
    lean.mockReset();
  });

  describe("getUserBranchInfo", () => {
    test("returns user branch and role info for existing user", async () => {
      findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          branch: "main",
          role: "branch_admin",
        }),
      });

      const info = await getUserBranchInfo("uid-123");
      expect(info).toEqual({
        branch: "main",
        role: "branch_admin",
        isOwner: false,
      });
    });

    test("returns isOwner true for owner role", async () => {
      findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          branch: "all",
          role: "owner",
        }),
      });

      const info = await getUserBranchInfo("uid-owner");
      expect(info).toEqual({
        branch: "all",
        role: "owner",
        isOwner: true,
      });
    });

    test("returns nulls when user is not found", async () => {
      findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const info = await getUserBranchInfo("uid-notfound");
      expect(info).toEqual({
        branch: null,
        role: null,
        isOwner: false,
      });
    });
  });

  describe("filterByBranch", () => {
    test("denies unauthenticated requests", async () => {
      const req = {};
      const res = createRes();
      const next = jest.fn();

      await filterByBranch(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe("USER_NOT_AUTHENTICATED");
    });

    test("allows owners full cross-branch access with branchFilter null", async () => {
      const req = {
        user: { uid: "owner-1" },
        authUser: { role: "owner", branch: null },
      };
      const res = createRes();
      const next = jest.fn();

      await filterByBranch(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.branchFilter).toBeNull();
      expect(req.userBranch).toBe("all");
      expect(req.isOwner).toBe(true);
    });

    test("denies branch admin when no branch is assigned", async () => {
      const req = {
        user: { uid: "admin-nobranch" },
        authUser: { role: "branch_admin", branch: null },
      };
      const res = createRes();
      const next = jest.fn();

      await filterByBranch(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe("NO_BRANCH_ASSIGNED");
    });

    test("scopes branch admin to their assigned branch", async () => {
      const req = {
        user: { uid: "admin-main" },
        authUser: { role: "branch_admin", branch: "main" },
      };
      const res = createRes();
      const next = jest.fn();

      await filterByBranch(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.branchFilter).toBe("main");
      expect(req.userBranch).toBe("main");
      expect(req.isOwner).toBe(false);
    });
  });

  describe("validateBranchAccess", () => {
    test("denies unauthenticated requests", async () => {
      const req = { params: { branch: "main" } };
      const res = createRes();
      const next = jest.fn();

      await validateBranchAccess(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe("USER_NOT_AUTHENTICATED");
    });

    test("rejects invalid branch names", async () => {
      findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          branch: "main",
          role: "branch_admin",
        }),
      });

      const req = {
        user: { uid: "admin-1" },
        params: { branch: "invalid_branch_xyz" },
      };
      const res = createRes();
      const next = jest.fn();

      await validateBranchAccess(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe("INVALID_BRANCH");
    });

    test("allows owner to access any valid branch", async () => {
      findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          branch: "main",
          role: "owner",
        }),
      });

      const req = {
        user: { uid: "owner-1" },
        params: { branch: "annex" },
      };
      const res = createRes();
      const next = jest.fn();

      await validateBranchAccess(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.isOwner).toBe(true);
    });

    test("denies branch admin trying to access a different branch", async () => {
      findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          branch: "main",
          role: "branch_admin",
        }),
      });

      const req = {
        user: { uid: "admin-main" },
        params: { branch: "annex" },
      };
      const res = createRes();
      const next = jest.fn();

      await validateBranchAccess(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe("BRANCH_ACCESS_DENIED");
    });

    test("allows branch admin to access their own branch", async () => {
      findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          branch: "main",
          role: "branch_admin",
        }),
      });

      const req = {
        user: { uid: "admin-main" },
        params: { branch: "main" },
      };
      const res = createRes();
      const next = jest.fn();

      await validateBranchAccess(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
