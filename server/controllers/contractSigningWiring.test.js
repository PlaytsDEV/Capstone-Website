import fs from "fs";
import path from "path";
import { describe, expect, test } from "@jest/globals";

const routes = fs.readFileSync(path.resolve("routes/contractRoutes.js"), "utf8");
const controller = fs.readFileSync(path.resolve("controllers/contractController.js"), "utf8");

describe("physical signing API security wiring", () => {
  test("all signing routes are below the admin permission boundary", () => {
    const boundary = routes.indexOf('router.use(verifyToken, verifyAdmin, filterByBranch, requirePermission("manageTenants"))');
    for (const endpoint of [
      "mark-printed", "signatures/tenant", "signatures/lessor",
      "signatures/witnesses", "documents/signed",
    ]) expect(routes.indexOf(endpoint)).toBeGreaterThan(boundary);
  });
  test("tenant routes expose prepared documents but never signed documents", () => {
    const boundary = routes.indexOf("router.use(verifyToken, verifyAdmin");
    expect(routes.slice(0, boundary)).toContain("documents/prepared");
    expect(routes.slice(0, boundary)).not.toContain("documents/signed");
  });
  test("branch access is applied to every signing controller operation", () => {
    expect(controller).toContain("assertContractBranchAccess(req, contract.branch)");
    expect(controller).toContain("loadSigningContract(req)");
  });
  test("admin JSON strips private signed storage keys", () => {
    expect(controller).toContain("delete contractObject.signedStorageKey");
    expect(controller).toContain("storageKey: _storageKey");
  });
  test("signed streams are private and disable caching", () => {
    expect(controller).toContain('Content-Disposition');
    expect(controller).toContain('Cache-Control", "private, no-store"');
  });
});
