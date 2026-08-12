import fs from "fs";

describe("mobile Contract route safety", () => {
  const routes = fs.readFileSync(new URL("./mobileContractRoutes.js", import.meta.url), "utf8");
  const mobileDocuments = fs.readFileSync(
    new URL("../mobile/controllers/user.controller.js", import.meta.url),
    "utf8",
  );
  const legacyGenerator = fs.readFileSync(
    new URL("../mobile/controllers/documents.controller.js", import.meta.url),
    "utf8",
  );

  test("uses the canonical tenant resolver on every document lookup", () => {
    expect(routes).toContain(
      'import { resolveTenantCanonicalContract } from "../services/tenantContractSelectionService.js"',
    );
    expect(routes).toContain(
      // Mobile opts into includeEarlyStages so a draft Contract is visible
      // (see tenantContractSelectionService.js), but ownership is still
      // resolved exclusively through resolveTenantCanonicalContract(tenantId, ...)
      // — never a raw, unscoped Contract lookup.
      "resolveTenantCanonicalContract(tenantId, { includeEarlyStages: true })",
    );
    expect(routes).toContain(
      "String(contract._id) !== String(req.params.contractId)",
    );
    expect(routes).not.toMatch(/moveIn|contractFileUrl/);
  });

  test("only publishes verified final files and never exposes signed-only files", () => {
    expect(routes).toContain("resolvePublishedFinalDocument(contract)");
    expect(routes).not.toMatch(/signedStorageKey|signedDocuments/);
  });

  test("legacy Reservation Contract URLs are excluded from the mobile document list", () => {
    expect(mobileDocuments).not.toMatch(/if \(reservation\.contractFileUrl\)/);
    expect(mobileDocuments).not.toMatch(/label: 'Signed Contract'/);
    expect(legacyGenerator).not.toMatch(/docType: 'LEASE AGREEMENT'/);
    expect(legacyGenerator).not.toMatch(/Month-to-month; either party may terminate/);
  });

  test("offers read-only current, prepared, and final endpoints only", () => {
    expect(routes).toMatch(/router\.get\("\/contracts\/current"/);
    expect(routes).toMatch(/router\.get\("\/contracts\/:contractId\/documents\/prepared"/);
    expect(routes).toMatch(/router\.get\("\/contracts\/:contractId\/documents\/final"/);
    expect(routes).not.toMatch(/router\.(post|put|patch|delete)\(/);
  });
});
