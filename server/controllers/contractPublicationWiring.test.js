import fs from "fs";
import path from "path";
import { describe, expect, test } from "@jest/globals";

const routes = fs.readFileSync(path.resolve("routes/contractRoutes.js"), "utf8");
const controller = fs.readFileSync(path.resolve("controllers/contractController.js"), "utf8");
const mobile = fs.readFileSync(path.resolve("routes/mobileContractRoutes.js"), "utf8");

describe("final publication API security wiring", () => {
  test("publication mutations are behind admin permission and branch middleware", () => {
    const boundary = routes.indexOf('router.use(verifyToken, verifyAdmin, filterByBranch, requirePermission("manageTenants"))');
    expect(routes.indexOf('router.post("/:id/ready-for-publication"')).toBeGreaterThan(boundary);
    expect(routes.indexOf('router.post("/:id/publish"')).toBeGreaterThan(boundary);
    expect(controller).toContain("loadSigningContract(req)");
    expect(controller).toContain("assertContractBranchAccess(req, contract.branch)");
  });

  test("tenant final access is ownership-scoped and mutation-free", () => {
    const boundary = routes.indexOf("router.use(verifyToken, verifyAdmin");
    const tenantRoutes = routes.slice(0, boundary);
    expect(tenantRoutes).toContain('documents/final');
    expect(tenantRoutes).not.toMatch(/post\([^)]*publish/);
    expect(controller).toContain("resolveTenantCanonicalContract(user._id)");
    expect(controller).toContain(
      "String(contract._id) !== String(req.params.contractId)",
    );
  });

  test("final streams are private and never accept storage keys from clients", () => {
    expect(controller).toContain('Cache-Control", "private, no-store"');
    expect(controller).not.toMatch(/req\.(body|query)\??\.storageKey/);
    expect(mobile).toContain("resolvePublishedFinalDocument(contract)");
    expect(mobile).toContain('Cache-Control", "private, no-store"');
  });

  test("normal admin responses strip final private storage and hashes", () => {
    expect(controller).toContain("delete contractObject.finalStorageKey");
    expect(controller).toContain("delete contractObject.finalDocument.storageKey");
    expect(controller).toContain("delete contractObject.finalDocument.fileHash");
  });
});
